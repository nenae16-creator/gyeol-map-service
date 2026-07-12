import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { chromium } from "playwright";

const cliArgs = process.argv.slice(2);
const sensitiveKeyNamePattern =
  /^(?:serviceKey|DATA_GO_KR_SERVICE_KEY|api[-_]?key|x-api-key|token|access[-_]?token|authorization)$/i;
const sensitiveAssignmentPattern =
  /["']?(?:serviceKey|DATA_GO_KR_SERVICE_KEY|api[-_]?key|x-api-key|token|access[-_]?token|authorization)["']?\s*[:=]/i;
const sensitiveMultipartFieldPattern =
  /\bname\s*=\s*["'](?:serviceKey|DATA_GO_KR_SERVICE_KEY|api[-_]?key|x-api-key|token|access[-_]?token|authorization)["']/i;

function readOption(name) {
  const prefix = `${name}=`;
  const option = cliArgs.find((argument) => argument.startsWith(prefix));
  return option?.slice(prefix.length).trim() || undefined;
}

function normalizeVersion(value) {
  if (
    !/^[\p{L}\p{N}._-]{1,80}$/u.test(value) ||
    value === "." ||
    value === ".."
  ) {
    throw new Error(
      "QA 결과 버전은 문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.",
    );
  }
  return value;
}

function isLoopback(hostname) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    /^127(?:\.|$)/.test(hostname)
  );
}

function normalizeBaseUrl(value, remoteExplicitlyAllowed) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("QA_BASE_URL은 유효한 HTTP 또는 HTTPS 주소여야 합니다.");
  }

  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  ) {
    throw new Error(
      "QA_BASE_URL에는 HTTP(S) 주소와 경로만 사용할 수 있습니다.",
    );
  }

  const remote = !isLoopback(url.hostname);
  if (remote && url.protocol !== "https:") {
    throw new Error("원격 QA 대상은 HTTPS 주소만 사용할 수 있습니다.");
  }
  if (remote && !remoteExplicitlyAllowed) {
    throw new Error(
      "원격 QA는 --url 옵션 또는 QA_ALLOW_REMOTE=1로 명시적으로 허용해야 합니다.",
    );
  }

  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

function redactSecrets(value) {
  const text = String(value ?? "");
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (url.username) url.username = "[REDACTED]";
      if (url.password) url.password = "[REDACTED]";
      for (const key of [...url.searchParams.keys()]) {
        url.searchParams.set(key, "[REDACTED]");
      }
      return url.toString();
    } catch {
      // URL처럼 보이는 진단 문자열도 아래의 일반 마스킹을 적용합니다.
    }
  }

  return text
    .replace(
      /("(?:serviceKey|DATA_GO_KR_SERVICE_KEY|api[-_]?key|x-api-key|token|access[-_]?token|authorization)"\s*:\s*)"[^"]*"/gi,
      '$1"[REDACTED]"',
    )
    .replace(
      /('(?:serviceKey|DATA_GO_KR_SERVICE_KEY|api[-_]?key|x-api-key|token|access[-_]?token|authorization)'\s*:\s*)'[^']*'/gi,
      "$1'[REDACTED]'",
    )
    .replace(
      /((?:serviceKey|DATA_GO_KR_SERVICE_KEY|api[-_]?key|x-api-key|token|access[-_]?token|authorization)\s*[=:]\s*)[^\s&,}\]]+/gi,
      "$1[REDACTED]",
    )
    .replace(
      /(\bauthorization\s*[:=]\s*)(?:bearer\s+)?[^\r\n,]+/gi,
      "$1[REDACTED]",
    );
}

function findSensitiveRequestFields(request) {
  const fields = [];
  try {
    const url = new URL(request.url());
    if (
      [...url.searchParams.keys()].some((key) =>
        sensitiveKeyNamePattern.test(key),
      )
    ) {
      fields.push("query");
    }
  } catch {
    if (sensitiveAssignmentPattern.test(request.url())) fields.push("url");
  }

  if (
    Object.keys(request.headers()).some((key) =>
      sensitiveKeyNamePattern.test(key),
    )
  ) {
    fields.push("header");
  }
  const postData = request.postData() ?? "";
  if (
    sensitiveAssignmentPattern.test(postData) ||
    sensitiveMultipartFieldPattern.test(postData)
  ) {
    fields.push("body");
  }
  return [...new Set(fields)];
}

const urlOption = readOption("--url");
const outputOption = readOption("--output");
const versionArgument =
  cliArgs.find((argument) => !argument.startsWith("--")) ?? "v2";
const version = normalizeVersion(versionArgument);
const configuredBaseUrl =
  urlOption ?? process.env.QA_BASE_URL?.trim() ?? "http://127.0.0.1:5187/";
const baseUrlObject = normalizeBaseUrl(
  configuredBaseUrl,
  Boolean(urlOption) || process.env.QA_ALLOW_REMOTE === "1",
);
const baseUrl = baseUrlObject.toString();
const qaOutputRoot = resolve("tmp");
const configuredOutputDir = outputOption ?? process.env.QA_OUTPUT_DIR?.trim();
const outputDir = resolve(configuredOutputDir || "tmp/qa");
const outputRelativePath = relative(qaOutputRoot, outputDir);
if (
  outputRelativePath === ".." ||
  outputRelativePath.startsWith(`..${sep}`) ||
  isAbsolute(outputRelativePath)
) {
  throw new Error("QA_OUTPUT_DIR은 프로젝트의 tmp 디렉터리 내부여야 합니다.");
}

await mkdir(outputDir, { recursive: true });

const report = {
  configuration: {
    baseUrl,
    outputDir,
    version,
  },
  desktop: {},
  mobile: {},
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  httpErrors: [],
  navigationErrors: [],
  blockedExternalRequests: [],
  imageErrors: [],
  fatalError: null,
  clientKeyLeak: false,
  clientKeyLeakFindings: [],
  coreChecks: {},
  failedChecks: [],
  ok: false,
};

function attachDiagnostics(page, scope) {
  page.on("request", (request) => {
    const fields = findSensitiveRequestFields(request);
    if (fields.length > 0) {
      report.clientKeyLeakFindings.push({
        scope,
        fields,
        url: redactSecrets(request.url()),
      });
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      report.consoleErrors.push(`[${scope}] ${redactSecrets(message.text())}`);
    }
  });
  page.on("pageerror", (error) => {
    report.pageErrors.push(`[${scope}] ${redactSecrets(error.message)}`);
  });
  page.on("requestfailed", (request) => {
    report.failedRequests.push({
      scope,
      url: redactSecrets(request.url()),
      error: redactSecrets(request.failure()?.errorText),
    });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      report.httpErrors.push({
        scope,
        status: response.status(),
        url: redactSecrets(response.url()),
      });
    }
  });
}

async function inspectImages(page, scope) {
  let timedOut = false;
  try {
    await page.waitForFunction(
      () => Array.from(document.images).every((image) => image.complete),
      undefined,
      { timeout: 20000 },
    );
  } catch {
    timedOut = true;
  }

  const images = await page.evaluate(() =>
    Array.from(document.images).map((image) => ({
      src: image.currentSrc || image.src,
      alt: image.alt,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    })),
  );

  for (const image of images) {
    if (
      !image.complete ||
      image.naturalWidth === 0 ||
      image.naturalHeight === 0
    ) {
      report.imageErrors.push({
        scope,
        src: redactSecrets(image.src),
        alt: image.alt,
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      });
    }
  }

  if (timedOut && !images.some((image) => !image.complete)) {
    report.imageErrors.push({
      scope,
      reason: "이미지 완료 상태 대기 시간 초과",
    });
  }
}

async function capture(page, filename, scope) {
  await inspectImages(page, scope);
  await page.screenshot({ path: join(outputDir, filename), fullPage: true });
}

async function navigate(page, targetUrl, scope) {
  const response = await page.goto(targetUrl, {
    waitUntil: "load",
    timeout: 30000,
  });
  if (!response || !response.ok()) {
    report.navigationErrors.push({
      scope,
      status: response?.status() ?? null,
      url: redactSecrets(targetUrl),
    });
  }

  const actualUrl = new URL(page.url());
  if (actualUrl.origin !== baseUrlObject.origin) {
    report.navigationErrors.push({
      scope,
      reason: "설정된 QA 출처 밖으로 이동했습니다.",
      url: redactSecrets(actualUrl.toString()),
    });
    throw new Error(`${scope} 단계에서 설정된 QA 출처 밖으로 이동했습니다.`);
  }
}

async function createContext(browser, options) {
  const context = await browser.newContext(options);
  if (!isLoopback(baseUrlObject.hostname)) {
    await context.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (
        /^https?:$/.test(requestUrl.protocol) &&
        requestUrl.origin !== baseUrlObject.origin
      ) {
        report.blockedExternalRequests.push({
          resourceType: route.request().resourceType(),
          url: redactSecrets(requestUrl.toString()),
        });
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
  }
  return context;
}

async function getLayout(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    };

    const rectByText = (selector, text) => {
      const node = Array.from(document.querySelectorAll(selector)).find(
        (element) => element.textContent?.includes(text),
      );
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    };

    return {
      viewport: { width: innerWidth, height: innerHeight },
      scroll: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      search: rect('form[role="search"]'),
      location: rectByText("button", "현재 위치 사용"),
      map: rect("figure"),
      panel: rect('section[aria-live="off"]'),
      progress: rect('nav[aria-label="서비스 진행 단계"]'),
    };
  });
}

function hasNoHorizontalOverflow(layout) {
  return Boolean(layout && layout.scroll.width <= layout.viewport.width + 1);
}

let browser;

try {
  browser = await chromium.launch({ headless: true });

  const desktopContext = await createContext(browser, {
    viewport: { width: 1487, height: 1058 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  const page = await desktopContext.newPage();
  attachDiagnostics(page, "desktop");

  await navigate(page, baseUrl, "desktop.idle");
  report.desktop.idleLayout = await getLayout(page);
  await capture(page, `service-idle-${version}.png`, "desktop.idle");

  report.desktop.tabOrder = [];
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press("Tab");
    report.desktop.tabOrder.push(
      await page.evaluate(() => ({
        tag: document.activeElement?.tagName ?? "",
        text:
          document.activeElement?.getAttribute("aria-label") ??
          document.activeElement?.textContent?.replace(/\s+/g, " ").trim() ??
          "",
      })),
    );
  }

  await page.getByRole("button", { name: "서울시청 예시로 해독하기" }).click();
  await page.waitForTimeout(850);
  report.desktop.decodingLayout = await getLayout(page);
  await capture(page, `service-decoding-${version}.png`, "desktop.decoding");

  await page
    .getByRole("heading", { name: "한양·한성부 권역 후보" })
    .waitFor({ state: "visible" });
  report.desktop.resultLayout = await getLayout(page);
  report.desktop.resultFocus = await page.evaluate(
    () => document.activeElement?.textContent?.trim() ?? "",
  );
  report.desktop.journeyButtonVisible = await page
    .getByRole("button", { name: "한성부 권역 지도 체험하기" })
    .isVisible();
  await capture(page, `service-result-${version}.png`, "desktop.result");

  const sourceLink = page
    .getByRole("link", { name: /국립중앙박물관 · 대동여지도/ })
    .first();
  report.desktop.sourceLink = await sourceLink.getAttribute("href");
  report.desktop.deliveryState = await page
    .getByText(/^(API 갱신 저장본|공식 원문 검수본)$/)
    .first()
    .textContent();
  report.desktop.mapRegistration = await page
    .getByText("로컬 좌표 임시 등록", { exact: true })
    .textContent();
  const publicDataSummary = page.getByText(
    /^(대동여지도 API 저장본|전국 박물관 유물정보_GW 연결 정보)$/,
  );
  await publicDataSummary.click();
  report.desktop.publicDataExpanded = await publicDataSummary
    .locator("xpath=ancestor::details")
    .evaluate((details) => details.open);
  report.desktop.publicDataStatus = await page
    .getByText(/^(공공데이터 저장본|API 연결 준비)$/)
    .textContent();

  await page.getByRole("button", { name: "한성부 권역 지도 체험하기" }).click();
  await page
    .getByRole("button", { name: "근거 결과로 돌아가기" })
    .waitFor({ state: "visible" });
  await page.locator('[data-ready="true"][data-phase]').waitFor({
    state: "attached",
    timeout: 30000,
  });
  report.desktop.journeyAssetsReady = true;
  await inspectImages(page, "desktop.journey");
  report.desktop.officialDoseongdoSrc = await page
    .getByRole("img", { name: /대동여지도 신유본 중 도성도/ })
    .getAttribute("src");
  report.desktop.routeIsVector =
    (await page.locator('svg[viewBox="0 0 1487 1058"] path').count()) === 2;
  await page.waitForTimeout(2200);
  await capture(page, `service-journey-${version}.png`, "desktop.journey");

  const skipButton = page.getByRole("button", { name: "이동 건너뛰기" });
  if (await skipButton.isVisible()) {
    await skipButton.click();
  }
  await page
    .locator('[data-phase="arrived"]')
    .waitFor({ state: "attached", timeout: 15000 });
  report.desktop.journeyArrived = true;
  await page
    .locator('li[aria-current="location"] strong')
    .waitFor({ state: "visible" });
  report.desktop.detailSourceLink = await page
    .getByRole("link", {
      name: /국립중앙박물관 「대동여지도」 신수19997 \(새 창\)/,
    })
    .getAttribute("href");
  report.desktop.detailLicenseLink = await page
    .getByRole("link", { name: /공공누리 제1유형 \(새 창\)/ })
    .getAttribute("href");
  report.desktop.activeDoseongdoLocation = await page
    .locator('li[aria-current="location"] strong')
    .textContent();
  report.desktop.koreanLandmarks = await page
    .locator('ul[aria-label="도성도 주요 지명 한글 판독"] li')
    .allTextContents();
  report.desktop.koreanReadingNote = await page
    .locator("#doseongdo-reading-note")
    .textContent();
  await capture(
    page,
    `service-journey-arrived-${version}.png`,
    "desktop.journey.arrived",
  );

  await page.getByRole("button", { name: "근거 결과로 돌아가기" }).click();
  await page
    .getByRole("heading", { name: "한양·한성부 권역 후보" })
    .waitFor({ state: "visible" });
  report.desktop.returnedToResult = true;

  await page.getByRole("button", { name: "다른 위치 찾기" }).click();
  await page.locator("#gyeol-place-search").fill("부산역");
  await page
    .locator('form[role="search"]')
    .evaluate((form) => form.requestSubmit());
  const alert = page.getByRole("alert");
  await alert.waitFor({ state: "visible" });
  report.desktop.unsupportedMessage = (await alert.textContent())
    ?.replace(/\s+/g, " ")
    .trim();
  await capture(
    page,
    `service-unsupported-${version}.png`,
    "desktop.unsupported",
  );

  const legacyUrl = new URL(baseUrl);
  legacyUrl.searchParams.set("legacy", "1");
  await navigate(page, legacyUrl.toString(), "desktop.legacy");
  await page.locator('[data-ready="true"][data-phase="idle"]').waitFor({
    state: "attached",
    timeout: 60000,
  });
  report.desktop.legacyAssetsReady = true;
  const legacyButton = page.getByRole("button", {
    name: "가운데 대동여지도에서 한성부를 선택해 여정을 시작하기",
  });
  report.desktop.legacyAvailable = await legacyButton.isVisible();
  report.desktop.legacyEnabled = await legacyButton.isEnabled();
  await capture(page, `service-legacy-${version}.png`, "desktop.legacy");

  await desktopContext.close();

  const mobileContext = await createContext(browser, {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const mobilePage = await mobileContext.newPage();
  attachDiagnostics(mobilePage, "mobile");

  await navigate(mobilePage, baseUrl, "mobile.idle");
  report.mobile.idleLayout = await getLayout(mobilePage);
  await capture(
    mobilePage,
    `service-mobile-idle-${version}.png`,
    "mobile.idle",
  );

  await mobilePage
    .getByRole("button", { name: "서울시청 예시로 해독하기" })
    .click();
  await mobilePage
    .getByRole("heading", { name: "한양·한성부 권역 후보" })
    .waitFor({ state: "visible" });
  report.mobile.resultLayout = await getLayout(mobilePage);
  report.mobile.journeyButtonVisible = await mobilePage
    .getByRole("button", { name: "한성부 권역 지도 체험하기" })
    .isVisible();
  await capture(
    mobilePage,
    `service-mobile-result-${version}.png`,
    "mobile.result",
  );

  await mobilePage
    .getByRole("button", { name: "한성부 권역 지도 체험하기" })
    .click();
  await mobilePage
    .getByRole("button", { name: "근거 결과로 돌아가기" })
    .waitFor({ state: "visible" });
  await mobilePage.locator('[data-ready="true"][data-phase]').waitFor({
    state: "attached",
    timeout: 30000,
  });
  report.mobile.journeyAssetsReady = true;
  await mobilePage.locator('[data-phase="arrived"]').waitFor({
    state: "attached",
    timeout: 15000,
  });
  report.mobile.journeyArrived = true;
  await mobilePage
    .locator('figure[aria-labelledby="doseongdo-korean-title"]')
    .waitFor({
      state: "visible",
    });
  await mobilePage.waitForTimeout(950);
  report.mobile.detailMapLayout = await mobilePage
    .locator('figure[aria-labelledby="doseongdo-korean-title"]')
    .evaluate((node) => {
      const box = node.getBoundingClientRect();
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    });
  report.mobile.activeDoseongdoLocation = await mobilePage
    .locator('li[aria-current="location"] strong')
    .textContent();
  await capture(
    mobilePage,
    `service-mobile-journey-arrived-${version}.png`,
    "mobile.journey.arrived",
  );

  await mobileContext.close();

  const locationContext = await createContext(browser, {
    viewport: { width: 1487, height: 1058 },
  });
  const locationPage = await locationContext.newPage();
  attachDiagnostics(locationPage, "location-permission");
  await navigate(locationPage, baseUrl, "location-permission.idle");
  await locationPage.getByRole("button", { name: "현재 위치 사용" }).click();
  const locationAlert = locationPage.getByRole("alert");
  await locationAlert.waitFor({ state: "visible", timeout: 10000 });
  report.desktop.locationDeniedMessage = (await locationAlert.textContent())
    ?.replace(/\s+/g, " ")
    .trim();
  await capture(
    locationPage,
    `service-location-denied-${version}.png`,
    "location-permission.denied",
  );
  await locationContext.close();
} catch (error) {
  report.fatalError = {
    name: error instanceof Error ? error.name : "Error",
    message: redactSecrets(error instanceof Error ? error.message : error),
  };
} finally {
  if (browser) {
    await browser.close().catch((error) => {
      report.pageErrors.push(`[browser.close] ${redactSecrets(error.message)}`);
    });
  }

  report.clientKeyLeak = report.clientKeyLeakFindings.length > 0;
  report.coreChecks = {
    desktopJourneyButton: report.desktop.journeyButtonVisible === true,
    desktopPublicDataExpanded: report.desktop.publicDataExpanded === true,
    desktopOfficialDoseongdo: /nmk-shinsu19997-doseongdo-original\.jpg/.test(
      report.desktop.officialDoseongdoSrc ?? "",
    ),
    desktopJourneyAssetsReady: report.desktop.journeyAssetsReady === true,
    desktopJourneyArrived: report.desktop.journeyArrived === true,
    desktopVectorRoute: report.desktop.routeIsVector === true,
    desktopArrived: Boolean(report.desktop.activeDoseongdoLocation),
    desktopSourceLink: /^https:\/\/www\.museum\.go\.kr\//.test(
      report.desktop.detailSourceLink ?? "",
    ),
    desktopLicenseLink: /^https:\/\/www\.kogl\.or\.kr\//.test(
      report.desktop.detailLicenseLink ?? "",
    ),
    desktopKoreanLandmarks:
      Array.isArray(report.desktop.koreanLandmarks) &&
      report.desktop.koreanLandmarks.length >= 3,
    desktopNoHorizontalOverflow: [
      report.desktop.idleLayout,
      report.desktop.decodingLayout,
      report.desktop.resultLayout,
    ].every(hasNoHorizontalOverflow),
    desktopReturnedToResult: report.desktop.returnedToResult === true,
    desktopUnsupportedLocation: Boolean(report.desktop.unsupportedMessage),
    desktopLegacyAssetsReady: report.desktop.legacyAssetsReady === true,
    desktopLegacyAvailable: report.desktop.legacyAvailable === true,
    desktopLegacyEnabled: report.desktop.legacyEnabled === true,
    mobileJourneyButton: report.mobile.journeyButtonVisible === true,
    mobileJourneyAssetsReady: report.mobile.journeyAssetsReady === true,
    mobileJourneyArrived: report.mobile.journeyArrived === true,
    mobileArrived: Boolean(report.mobile.activeDoseongdoLocation),
    mobileNoHorizontalOverflow: [
      report.mobile.idleLayout,
      report.mobile.resultLayout,
    ].every(hasNoHorizontalOverflow),
    locationPermissionDenied: /위치 권한을 사용할 수 없습니다/.test(
      report.desktop.locationDeniedMessage ?? "",
    ),
  };
  report.failedChecks = Object.entries(report.coreChecks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  report.ok =
    !report.fatalError &&
    report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 &&
    report.failedRequests.length === 0 &&
    report.httpErrors.length === 0 &&
    report.navigationErrors.length === 0 &&
    report.blockedExternalRequests.length === 0 &&
    report.imageErrors.length === 0 &&
    !report.clientKeyLeak &&
    report.failedChecks.length === 0;

  const reportPath = join(outputDir, `playwright-report-${version}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) process.exitCode = 1;
}
