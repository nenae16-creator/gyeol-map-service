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
  cheonan: {
    desktop: {},
    mobile: {},
  },
  consoleErrors: [],
  expectedConsoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  httpErrors: [],
  expectedHttpErrors: [],
  navigationErrors: [],
  blockedExternalRequests: [],
  directProviderRequests: [],
  mockedRoadDistanceRequests: [],
  imageErrors: [],
  fatalError: null,
  clientKeyLeak: false,
  clientKeyLeakFindings: [],
  coreChecks: {},
  failedChecks: [],
  ok: false,
};

function attachDiagnostics(page, scope, options = {}) {
  page.on("request", (request) => {
    try {
      const requestUrl = new URL(request.url());
      if (requestUrl.hostname === "apis-navi.kakaomobility.com") {
        report.directProviderRequests.push({
          scope,
          url: redactSecrets(requestUrl.toString()),
        });
      }
    } catch {
      // URL 파싱 실패는 아래의 기존 요청 진단에서 별도로 다룹니다.
    }
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
      const errorRecord = `[${scope}] ${redactSecrets(message.text())}`;
      if (options.isExpectedConsoleError?.(message)) {
        report.expectedConsoleErrors.push(errorRecord);
      } else {
        report.consoleErrors.push(errorRecord);
      }
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
      const errorRecord = {
        scope,
        status: response.status(),
        url: redactSecrets(response.url()),
      };
      if (options.isExpectedHttpError?.(response)) {
        report.expectedHttpErrors.push(errorRecord);
      } else {
        report.httpErrors.push(errorRecord);
      }
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

const roadDistanceFixtures = Object.freeze({
  "seoul-city-hall": Object.freeze({
    distanceMeters: 143_321,
    durationSeconds: 7_502,
  }),
  gwanghwamun: Object.freeze({
    distanceMeters: 144_987,
    durationSeconds: 7_812,
  }),
  gyeongbokgung: Object.freeze({
    distanceMeters: 145_410,
    durationSeconds: 7_920,
  }),
});

async function installRoadDistanceMock(context, scope, status = "success") {
  await context.route("**/api/road-distance*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname !== "/api/road-distance") {
      await route.continue();
      return;
    }

    const destinationId = requestUrl.searchParams.get("destinationId") ?? "";
    const fixture = roadDistanceFixtures[destinationId];
    const unavailable = status === "unavailable";
    report.mockedRoadDistanceRequests.push({
      scope,
      destinationId,
      status: unavailable ? 503 : fixture ? 200 : 400,
    });

    if (unavailable) {
      await route.fulfill({
        status: 503,
        contentType: "application/json; charset=utf-8",
        headers: { "Cache-Control": "no-store" },
        body: JSON.stringify({
          status: "unavailable",
          code: "provider-not-configured",
        }),
      });
      return;
    }

    if (!fixture) {
      await route.fulfill({
        status: 400,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          status: "unavailable",
          code: "unsupported-destination",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify({
        status: "success",
        destinationId,
        method: "driving-route",
        provider: "kakao-mobility",
        priority: "RECOMMEND",
        ...fixture,
      }),
    });
  });
}

async function waitForRoadDistanceState(page, status) {
  await page
    .locator(
      `dl[aria-label="현대 거리와 고지도 거리 비교"][data-road-distance-status="${status}"]`,
    )
    .waitFor({ state: "attached", timeout: 10000 });
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
  await installRoadDistanceMock(desktopContext, "desktop");
  const page = await desktopContext.newPage();
  attachDiagnostics(page, "desktop");

  await navigate(page, baseUrl, "desktop.idle");
  report.desktop.idleLayout = await getLayout(page);
  report.cheonan.desktop.defaultQuery = await page
    .locator("#gyeol-place-search")
    .inputValue();
  report.cheonan.desktop.defaultPlaceCard = (
    await page
      .getByText("첫 시범 위치", { exact: true })
      .locator("..")
      .textContent()
  )
    ?.replace(/\s+/g, " ")
    .trim();
  report.cheonan.desktop.defaultActionVisible = await page
    .getByRole("button", { name: "천안역 예시로 해독하기" })
    .isVisible();
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

  await page.locator("#gyeol-place-search").fill("서울시청");
  await page
    .locator('form[role="search"]')
    .evaluate((form) => form.requestSubmit());
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
  const routeSvg = page.locator(
    'svg[data-route-distance-unit="experience-step"]',
  );
  const routeStepDashPaths = routeSvg.locator(
    'path[data-route-kind="step-dash"][data-distance-unit="1-step"]',
  );
  const routeRevealPath = routeSvg.locator('path[data-route-kind="reveal"]');
  const routeMarkers = page.locator('[data-route-marker-step]');
  report.desktop.routeStepCount = Number(
    await routeSvg.getAttribute("data-route-step-count"),
  );
  report.desktop.routeDashPattern = await routeStepDashPaths.first().evaluate(
    (path) => getComputedStyle(path).strokeDasharray,
  );
  report.desktop.routePathLengths = await routeStepDashPaths.evaluateAll(
    (paths) => paths.map((path) => Number(path.getAttribute("pathLength"))),
  );
  report.desktop.routeMarkerSteps = await routeMarkers.evaluateAll(
    (markers) =>
      markers.map((marker) =>
        Number(marker.getAttribute("data-route-marker-step")),
      ),
  );
  const expectedMarkerSteps = [];
  for (let step = 10; step < report.desktop.routeStepCount; step += 10) {
    expectedMarkerSteps.push(step);
  }
  report.desktop.routeIsVector =
    (await routeStepDashPaths.count()) === 2 &&
    (await routeRevealPath.count()) === 1;
  report.desktop.routeUsesStepDashes =
    report.desktop.routeStepCount >= 10 &&
    /0\.62(?:px)?[,\s]+0\.38/.test(report.desktop.routeDashPattern) &&
    report.desktop.routePathLengths.every(
      (length) => length === report.desktop.routeStepCount,
    );
  report.desktop.routeMarkersMatch =
    JSON.stringify(report.desktop.routeMarkerSteps) ===
    JSON.stringify(expectedMarkerSteps);
  await page
    .locator('[data-phase="revealing"]')
    .waitFor({ state: "attached", timeout: 30000 });
  await page.waitForFunction(
    () => {
      const path = document.querySelector('path[data-route-kind="reveal"]');
      if (!path) return false;
      const style = getComputedStyle(path);
      const offset = Number.parseFloat(style.strokeDashoffset);
      const length = Number.parseFloat(style.strokeDasharray);
      return offset > 0.1 && offset < length - 0.1;
    },
    undefined,
    { timeout: 10000 },
  );
  const routeMeasure = page.locator(
    'aside[aria-label="거리 비교와 체험 눈금 안내"]',
  );
  await page.waitForFunction(
    () => {
      const note = document.querySelector(
        'aside[aria-label="거리 비교와 체험 눈금 안내"]',
      );
      return note && Number.parseFloat(getComputedStyle(note).opacity) > 0.9;
    },
    undefined,
    { timeout: 10000 },
  );
  report.desktop.routeMeasureVisible = await routeMeasure.evaluate(
    (note) => Number.parseFloat(getComputedStyle(note).opacity) > 0.9,
  );
  report.desktop.routeMeasureLayout = await routeMeasure.evaluate((note) => {
    const box = note.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
  report.desktop.journeySceneLayout = await page
    .locator('section[aria-label^="대동여지도에서 도성도"]')
    .evaluate((scene) => {
      const box = scene.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    });
  report.desktop.routeMeasureText = (await routeMeasure.textContent())
    ?.replace(/\s+/g, " ")
    .trim();
  const distanceComparison = routeMeasure.locator(
    'dl[aria-label="현대 거리와 고지도 거리 비교"]',
  );
  await waitForRoadDistanceState(page, "success");
  report.desktop.routeMeasureText = (await routeMeasure.textContent())
    ?.replace(/\s+/g, " ")
    .trim();
  report.desktop.modernDistanceMeters = Number(
    await distanceComparison.getAttribute("data-modern-distance-meters"),
  );
  report.desktop.modernDistanceMethod = await distanceComparison.getAttribute(
    "data-distance-method",
  );
  report.desktop.modernDistanceOrigin = await distanceComparison.getAttribute(
    "data-origin-id",
  );
  report.desktop.modernDistanceDestination =
    await distanceComparison.getAttribute("data-destination-id");
  report.desktop.roadDistanceStatus = await distanceComparison.getAttribute(
    "data-road-distance-status",
  );
  report.desktop.roadDistanceMeters = Number(
    await distanceComparison.getAttribute("data-road-distance-meters"),
  );
  report.desktop.roadDurationSeconds = Number(
    await distanceComparison.getAttribute("data-road-duration-seconds"),
  );
  report.desktop.roadDistanceMethod = await distanceComparison.getAttribute(
    "data-road-distance-method",
  );
  report.desktop.distanceRows = await distanceComparison.locator("div").evaluateAll(
    (rows) =>
      rows.map((row) => ({
        term: row.querySelector("dt")?.textContent?.trim() ?? "",
        value: row.querySelector("dd")?.textContent?.trim() ?? "",
      })),
  );
  report.desktop.modernDistanceText = await distanceComparison
    .locator("dd")
    .first()
    .textContent();
  report.desktop.modernDistanceBasis = await routeMeasure
    .locator("p")
    .filter({ hasText: "좌표 기준" })
    .textContent();
  report.desktop.routeRevealInProgress = await routeRevealPath.evaluate((path) => {
    const style = getComputedStyle(path);
    const offset = Number.parseFloat(style.strokeDashoffset);
    const length = Number.parseFloat(style.strokeDasharray);
    return offset > 0 && offset < length;
  });
  await capture(page, `service-journey-${version}.png`, "desktop.journey");

  await page
    .locator('[data-phase="walking"]')
    .waitFor({ state: "attached", timeout: 15000 });
  const routeProgress = page.getByRole("progressbar", {
    name: "실제 거리와 무관한 체험 경로 진행",
  });
  await page.waitForFunction(
    () => {
      const progress = document.querySelector('[role="progressbar"]');
      if (!progress) return false;
      const current = Number(progress.getAttribute("aria-valuenow"));
      const maximum = Number(progress.getAttribute("aria-valuemax"));
      return current > 0 && current < maximum;
    },
    undefined,
    { timeout: 10000 },
  );
  const firstProgressStep = Number(
    await routeProgress.getAttribute("aria-valuenow"),
  );
  await page.waitForFunction(
    (previousStep) => {
      const progress = document.querySelector('[role="progressbar"]');
      return Number(progress?.getAttribute("aria-valuenow")) > previousStep;
    },
    firstProgressStep,
    { timeout: 5000 },
  );
  await page.waitForFunction(
    () => {
      const milestones = document.querySelector(
        'ol[aria-label="체험 눈금 10칸 단위 이정표"]',
      );
      return milestones && Number.parseFloat(getComputedStyle(milestones).opacity) > 0.9;
    },
    undefined,
    { timeout: 5000 },
  );
  report.desktop.routeProgressStep = Number(
    await routeProgress.getAttribute("aria-valuenow"),
  );
  report.desktop.routeProgressMax = Number(
    await routeProgress.getAttribute("aria-valuemax"),
  );
  report.desktop.routeProgressPercent = Number(
    await routeProgress.getAttribute("data-progress-percent"),
  );
  report.desktop.routeProgressText = await routeProgress.getAttribute(
    "aria-valuetext",
  );
  report.desktop.routeProgressIncreases =
    report.desktop.routeProgressStep > firstProgressStep;
  report.desktop.routeMarkersVisible = true;
  await capture(
    page,
    `service-journey-progress-${version}.png`,
    "desktop.journey.progress",
  );

  const skipButton = page.getByRole("button", { name: "이동 건너뛰기" });
  if (await skipButton.isVisible()) {
    await skipButton.click();
  }
  await page
    .locator('[data-phase="arrived"]')
    .waitFor({ state: "attached", timeout: 15000 });
  report.desktop.journeyArrived = true;
  report.desktop.routeRevealComplete = await routeRevealPath.evaluate(
    (path) =>
      Math.abs(Number.parseFloat(getComputedStyle(path).strokeDashoffset)) < 0.1,
  );
  report.desktop.routeProgressComplete =
    Number(await routeProgress.getAttribute("aria-valuenow")) ===
      report.desktop.routeStepCount &&
    Number(await routeProgress.getAttribute("data-progress-percent")) === 100 &&
    /100%/.test((await routeProgress.getAttribute("aria-valuetext")) ?? "");
  report.desktop.arrivalStepText = await page
    .locator('[data-phase="arrived"]')
    .getByText(`총 ${report.desktop.routeStepCount}칸`, { exact: true })
    .textContent();
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

  await waitForRoadDistanceState(page, "success");
  await page.waitForLoadState("networkidle", { timeout: 10000 });
  await desktopContext.close();

  const mobileContext = await createContext(browser, {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  await installRoadDistanceMock(mobileContext, "mobile");
  const mobilePage = await mobileContext.newPage();
  attachDiagnostics(mobilePage, "mobile");

  await navigate(mobilePage, baseUrl, "mobile.idle");
  report.mobile.idleLayout = await getLayout(mobilePage);
  await capture(
    mobilePage,
    `service-mobile-idle-${version}.png`,
    "mobile.idle",
  );

  await mobilePage.locator("#gyeol-place-search").fill("서울시청");
  await mobilePage
    .locator('form[role="search"]')
    .evaluate((form) => form.requestSubmit());
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
  const mobileRouteMeasure = mobilePage.locator(
    'aside[aria-label="거리 비교와 체험 눈금 안내"]',
  );
  await waitForRoadDistanceState(mobilePage, "success");
  report.mobile.routeMeasureVisible = await mobileRouteMeasure.evaluate(
    (note) => Number.parseFloat(getComputedStyle(note).opacity) > 0.9,
  );
  report.mobile.routeMeasureText = (await mobileRouteMeasure.textContent())
    ?.replace(/\s+/g, " ")
    .trim();
  report.mobile.routeCautionVisible = await mobilePage
    .getByText("체험 30칸은 거리 단위 아님", { exact: true })
    .isVisible();
  const mobileDistanceComparison = mobileRouteMeasure.locator(
    'dl[aria-label="현대 거리와 고지도 거리 비교"]',
  );
  report.mobile.modernDistanceMeters = Number(
    await mobileDistanceComparison.getAttribute("data-modern-distance-meters"),
  );
  report.mobile.roadDistanceStatus = await mobileDistanceComparison.getAttribute(
    "data-road-distance-status",
  );
  report.mobile.roadDistanceMeters = Number(
    await mobileDistanceComparison.getAttribute("data-road-distance-meters"),
  );
  report.mobile.roadDurationSeconds = Number(
    await mobileDistanceComparison.getAttribute("data-road-duration-seconds"),
  );
  report.mobile.roadDistanceMethod = await mobileDistanceComparison.getAttribute(
    "data-road-distance-method",
  );
  const mobileDistanceStatus = mobileRouteMeasure.locator(
    'p[aria-label*="공주시청에서 서울시청까지"]',
  );
  report.mobile.distanceLines = await mobileDistanceStatus.locator("span").allTextContents();
  report.mobile.distanceLinesVisible = await mobileDistanceStatus
    .locator("span")
    .evaluateAll((lines) =>
      lines.map((line) => {
        const style = getComputedStyle(line);
        const box = line.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && box.height > 0;
      }),
    );
  const mobileRouteProgress = mobilePage.getByRole("progressbar", {
    name: "실제 거리와 무관한 체험 경로 진행",
  });
  report.mobile.routeProgressComplete =
    Number(await mobileRouteProgress.getAttribute("aria-valuenow")) ===
      Number(await mobileRouteProgress.getAttribute("aria-valuemax")) &&
    Number(await mobileRouteProgress.getAttribute("data-progress-percent")) === 100 &&
    /100%/.test((await mobileRouteProgress.getAttribute("aria-valuetext")) ?? "");
  report.mobile.routeProgressMax = Number(
    await mobileRouteProgress.getAttribute("aria-valuemax"),
  );
  report.mobile.arrivalStepText = await mobilePage
    .getByText(`총 ${await mobileRouteProgress.getAttribute("aria-valuemax")}칸`, {
      exact: true,
    })
    .textContent();
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
  const detailCreditToggle = mobilePage.getByRole("button", {
    name: "판독·출처 보기",
  });
  report.mobile.detailCreditCollapsed =
    (await detailCreditToggle.isVisible()) &&
    (await detailCreditToggle.getAttribute("aria-expanded")) === "false";
  await detailCreditToggle.click();
  const detailCreditContent = mobilePage.locator("#doseongdo-credit-content");
  report.mobile.detailCreditExpanded =
    (await detailCreditContent.evaluate((content) => {
      const style = getComputedStyle(content);
      const box = content.getBoundingClientRect();
      return style.display !== "none" && box.height > 0;
    })) &&
    (await mobilePage
      .getByRole("link", { name: /국립중앙박물관.*새 창/ })
      .isVisible());
  await mobilePage.getByRole("button", { name: "판독·출처 접기" }).click();
  report.mobile.detailCreditRecollapsed =
    (await detailCreditToggle.getAttribute("aria-expanded")) === "false";
  await capture(
    mobilePage,
    `service-mobile-journey-arrived-${version}.png`,
    "mobile.journey.arrived",
  );

  await mobilePage.waitForLoadState("networkidle", { timeout: 10000 });
  await mobileContext.close();

  const cheonanContext = await createContext(browser, {
    viewport: { width: 1487, height: 1058 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await installRoadDistanceMock(cheonanContext, "cheonan");
  const cheonanPage = await cheonanContext.newPage();
  attachDiagnostics(cheonanPage, "cheonan");
  await navigate(cheonanPage, baseUrl, "cheonan.idle");
  report.cheonan.desktop.idleLayout = await getLayout(cheonanPage);
  report.cheonan.desktop.defaultQuery = await cheonanPage
    .locator("#gyeol-place-search")
    .inputValue();
  report.cheonan.desktop.defaultPlaceCard = (
    await cheonanPage
      .getByText("첫 시범 위치", { exact: true })
      .locator("..")
      .textContent()
  )
    ?.replace(/\s+/g, " ")
    .trim();

  await cheonanPage.locator("#gyeol-place-search").fill("천안역");
  await cheonanPage
    .locator('form[role="search"]')
    .evaluate((form) => form.requestSubmit());
  const cheonanDecodingScene = cheonanPage.locator(
    'section[data-stage="decoding"]',
  );
  await cheonanDecodingScene.waitFor({ state: "attached", timeout: 5000 });
  report.cheonan.desktop.decodingPlace = await cheonanPage
    .getByText("천안역 · 충청남도 천안시 동남구 대흥로 239", {
      exact: true,
    })
    .textContent();
  report.cheonan.desktop.decodingBusy =
    (await cheonanDecodingScene.getAttribute("aria-busy")) === "true";
  await capture(
    cheonanPage,
    `service-cheonan-decoding-${version}.png`,
    "cheonan.decoding",
  );

  const cheonanResultHeading = cheonanPage.getByRole("heading", {
    name: "천안군 권역 후보",
  });
  await cheonanResultHeading.waitFor({ state: "visible", timeout: 10000 });
  report.cheonan.desktop.resultLayout = await getLayout(cheonanPage);
  report.cheonan.desktop.resultHeading = await cheonanResultHeading.textContent();
  report.cheonan.desktop.resultFocus = await cheonanPage.evaluate(
    () => document.activeElement?.textContent?.trim() ?? "",
  );

  const cheonanInferenceDetails = cheonanPage.locator("details").filter({
    has: cheonanPage.getByText("현대 위치와 역사 권역의 대응", {
      exact: true,
    }),
  });
  if (!(await cheonanInferenceDetails.evaluate((details) => details.open))) {
    await cheonanInferenceDetails.locator("summary").click();
  }
  report.cheonan.desktop.inferenceText = await cheonanInferenceDetails
    .locator("p")
    .first()
    .textContent();
  report.cheonan.desktop.inferenceSources = await cheonanInferenceDetails
    .locator('ul[aria-label="현대 위치와 역사 권역의 대응 출처"] li')
    .evaluateAll((items) =>
      items.map((item) => {
        const link = item.querySelector("a");
        return {
          label: link?.textContent?.replace(/\s+/g, " ").trim() ?? "",
          href: link?.href ?? "",
          metadata:
            item.querySelector("span")?.textContent?.replace(/\s+/g, " ").trim() ??
            "",
        };
      }),
    );

  const cheonanJourneyButton = cheonanPage
    .locator("button")
    .filter({ hasText: "천안군 권역 판본 확대하기" });
  report.cheonan.desktop.journeyButtonText = (
    await cheonanJourneyButton.textContent()
  )
    ?.replace(/\s+/g, " ")
    .trim();
  report.cheonan.desktop.journeyButtonLabel =
    await cheonanJourneyButton.getAttribute("aria-label");
  await capture(
    cheonanPage,
    `service-cheonan-result-${version}.png`,
    "cheonan.result",
  );

  await cheonanJourneyButton.click();
  const cheonanRegionalMap = cheonanPage.locator(
    '[data-testid="regional-map-zoom"]',
  );
  await cheonanRegionalMap.waitFor({ state: "visible", timeout: 10000 });
  await cheonanPage.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="regional-map-zoom"]')
        ?.getAttribute("data-ready") === "true",
    undefined,
    { timeout: 10000 },
  );
  await cheonanPage.waitForTimeout(2800);
  report.cheonan.desktop.regionalMapReady =
    (await cheonanRegionalMap.getAttribute("data-ready")) === "true";
  report.cheonan.desktop.regionalMapLabel =
    await cheonanRegionalMap.getAttribute("aria-label");
  const cheonanZoomHeading = cheonanPage.getByRole("heading", {
    name: "천안 표기 판면 확대",
  });
  report.cheonan.desktop.zoomHeading = await cheonanZoomHeading.textContent();
  report.cheonan.desktop.zoomHeadingVisible =
    await cheonanZoomHeading.isVisible();
  report.cheonan.desktop.coordinateWarning = await cheonanPage
    .getByText("현대 천안역과 옛 지도의 천안 표기는 같은 점이 아닙니다.", {
      exact: true,
    })
    .textContent();
  report.cheonan.desktop.officialSheetBackground = await cheonanPage
    .getByRole("img", {
      name: "국립중앙박물관 대동여지도 공식 판면에서 천안 표기를 확대한 모습",
    })
    .evaluate((image) => getComputedStyle(image).backgroundImage);
  report.cheonan.desktop.zoomLayout = await getLayout(cheonanPage);
  await capture(
    cheonanPage,
    `service-cheonan-regional-zoom-${version}.png`,
    "cheonan.regional-zoom",
  );

  await cheonanPage
    .getByRole("button", { name: "근거 결과로 돌아가기" })
    .click();
  await cheonanResultHeading.waitFor({ state: "visible", timeout: 10000 });
  report.cheonan.desktop.returnedToResult =
    (await cheonanResultHeading.textContent()) === "천안군 권역 후보";
  report.cheonan.desktop.roadDistanceRequestCount =
    report.mockedRoadDistanceRequests.filter(
      (request) => request.scope === "cheonan",
    ).length;
  await cheonanContext.close();

  const cheonanMobileContext = await createContext(browser, {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  await installRoadDistanceMock(cheonanMobileContext, "cheonan-mobile");
  const cheonanMobilePage = await cheonanMobileContext.newPage();
  attachDiagnostics(cheonanMobilePage, "cheonan-mobile");
  await navigate(cheonanMobilePage, baseUrl, "cheonan-mobile.idle");
  report.cheonan.mobile.idleLayout = await getLayout(cheonanMobilePage);
  report.cheonan.mobile.defaultQuery = await cheonanMobilePage
    .locator("#gyeol-place-search")
    .inputValue();
  await cheonanMobilePage.locator("#gyeol-place-search").fill("천안역");
  await cheonanMobilePage
    .locator('form[role="search"]')
    .evaluate((form) => form.requestSubmit());
  await cheonanMobilePage
    .getByRole("heading", { name: "천안군 권역 후보" })
    .waitFor({ state: "visible", timeout: 10000 });
  report.cheonan.mobile.resultLayout = await getLayout(cheonanMobilePage);
  report.cheonan.mobile.resultHeadingVisible = await cheonanMobilePage
    .getByRole("heading", { name: "천안군 권역 후보" })
    .isVisible();
  const cheonanMobileJourneyButton = cheonanMobilePage
    .locator("button")
    .filter({ hasText: "천안군 권역 판본 확대하기" });
  report.cheonan.mobile.journeyButtonVisible =
    await cheonanMobileJourneyButton.isVisible();
  await capture(
    cheonanMobilePage,
    `service-mobile-cheonan-result-${version}.png`,
    "cheonan-mobile.result",
  );

  await cheonanMobileJourneyButton.click();
  const cheonanMobileRegionalMap = cheonanMobilePage.locator(
    '[data-testid="regional-map-zoom"]',
  );
  await cheonanMobileRegionalMap.waitFor({ state: "visible", timeout: 10000 });
  await cheonanMobilePage.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="regional-map-zoom"]')
        ?.getAttribute("data-ready") === "true",
    undefined,
    { timeout: 10000 },
  );
  report.cheonan.mobile.zoomLayout = await getLayout(cheonanMobilePage);
  report.cheonan.mobile.zoomHeadingVisible = await cheonanMobilePage
    .getByRole("heading", { name: "천안 표기 판면 확대" })
    .isVisible();
  report.cheonan.mobile.coordinateWarningVisible = await cheonanMobilePage
    .getByText("현대 천안역과 옛 지도의 천안 표기는 같은 점이 아닙니다.", {
      exact: true,
    })
    .isVisible();
  await capture(
    cheonanMobilePage,
    `service-mobile-cheonan-regional-zoom-${version}.png`,
    "cheonan-mobile.regional-zoom",
  );
  report.cheonan.mobile.roadDistanceRequestCount =
    report.mockedRoadDistanceRequests.filter(
      (request) => request.scope === "cheonan-mobile",
    ).length;
  await cheonanMobileContext.close();

  const alternateDistanceContext = await createContext(browser, {
    viewport: { width: 1487, height: 1058 },
    reducedMotion: "reduce",
  });
  await installRoadDistanceMock(alternateDistanceContext, "alternate-distance");
  const alternateDistancePage = await alternateDistanceContext.newPage();
  attachDiagnostics(alternateDistancePage, "alternate-distance");
  await navigate(alternateDistancePage, baseUrl, "alternate-distance.idle");
  await alternateDistancePage.locator("#gyeol-place-search").fill("광화문");
  await alternateDistancePage
    .locator('form[role="search"]')
    .evaluate((form) => form.requestSubmit());
  await alternateDistancePage
    .getByRole("heading", { name: "한양·한성부 권역 후보" })
    .waitFor({ state: "visible" });
  await alternateDistancePage
    .getByRole("button", { name: "한성부 권역 지도 체험하기" })
    .click();
  await alternateDistancePage.locator('[data-ready="true"][data-phase="arrived"]').waitFor({
    state: "attached",
    timeout: 30000,
  });
  const alternateDistanceComparison = alternateDistancePage.locator(
    'dl[aria-label="현대 거리와 고지도 거리 비교"]',
  );
  await waitForRoadDistanceState(alternateDistancePage, "success");
  report.desktop.alternateDistanceMeters = Number(
    await alternateDistanceComparison.getAttribute("data-modern-distance-meters"),
  );
  report.desktop.alternateDistanceDestination =
    await alternateDistanceComparison.getAttribute("data-destination-id");
  report.desktop.alternateRoadDistanceStatus =
    await alternateDistanceComparison.getAttribute("data-road-distance-status");
  report.desktop.alternateRoadDistanceMeters = Number(
    await alternateDistanceComparison.getAttribute("data-road-distance-meters"),
  );
  report.desktop.alternateRoadDurationSeconds = Number(
    await alternateDistanceComparison.getAttribute("data-road-duration-seconds"),
  );
  report.desktop.alternateRoadDistanceMethod =
    await alternateDistanceComparison.getAttribute("data-road-distance-method");
  report.desktop.alternateRoadDistanceText = await alternateDistanceComparison
    .locator("dd")
    .nth(1)
    .textContent();
  report.desktop.alternateDistanceText = await alternateDistanceComparison
    .locator("dd")
    .first()
    .textContent();
  report.desktop.alternateDistanceLocation = await alternateDistancePage
    .locator('li[aria-current="location"] strong')
    .textContent();
  await capture(
    alternateDistancePage,
    `service-alternate-distance-${version}.png`,
    "alternate-distance.arrived",
  );
  await alternateDistancePage.waitForLoadState("networkidle", { timeout: 10000 });
  await alternateDistanceContext.close();

  const grantedLocationContext = await createContext(browser, {
    viewport: { width: 1487, height: 1058 },
    reducedMotion: "reduce",
    permissions: ["geolocation"],
    geolocation: { latitude: 37.57, longitude: 126.98 },
  });
  await installRoadDistanceMock(grantedLocationContext, "location-granted");
  const grantedLocationPage = await grantedLocationContext.newPage();
  attachDiagnostics(grantedLocationPage, "location-granted");
  await navigate(grantedLocationPage, baseUrl, "location-granted.idle");
  await grantedLocationPage
    .getByRole("button", { name: "현재 위치 사용" })
    .click();
  await grantedLocationPage
    .getByRole("heading", { name: "한양·한성부 권역 후보" })
    .waitFor({ state: "visible" });
  await grantedLocationPage
    .getByRole("button", { name: "한성부 권역 지도 체험하기" })
    .click();
  await grantedLocationPage.locator('[data-ready="true"][data-phase="arrived"]').waitFor({
    state: "attached",
    timeout: 30000,
  });
  const grantedLocationDistance = grantedLocationPage.locator(
    'dl[aria-label="현대 거리와 고지도 거리 비교"]',
  );
  await waitForRoadDistanceState(grantedLocationPage, "success");
  report.desktop.grantedLocationDistanceMeters = Number(
    await grantedLocationDistance.getAttribute("data-modern-distance-meters"),
  );
  report.desktop.grantedLocationDistanceDestination =
    await grantedLocationDistance.getAttribute("data-destination-id");
  report.desktop.grantedLocationRoadStatus =
    await grantedLocationDistance.getAttribute("data-road-distance-status");
  report.desktop.grantedLocationRoadMeters = Number(
    await grantedLocationDistance.getAttribute("data-road-distance-meters"),
  );
  report.desktop.grantedLocationRoadDurationSeconds = Number(
    await grantedLocationDistance.getAttribute("data-road-duration-seconds"),
  );
  report.desktop.grantedLocationRoadMethod =
    await grantedLocationDistance.getAttribute("data-road-distance-method");
  report.desktop.grantedLocationDistanceBasis = await grantedLocationPage
    .getByText(/공주시청 ↔ 서울시청 좌표 기준/)
    .textContent();
  await capture(
    grantedLocationPage,
    `service-location-granted-${version}.png`,
    "location-granted.arrived",
  );
  await grantedLocationPage.waitForLoadState("networkidle", { timeout: 10000 });
  await grantedLocationContext.close();

  const unavailableRoadContext = await createContext(browser, {
    viewport: { width: 1487, height: 1058 },
    reducedMotion: "reduce",
  });
  await installRoadDistanceMock(
    unavailableRoadContext,
    "road-distance-unavailable",
    "unavailable",
  );
  const unavailableRoadPage = await unavailableRoadContext.newPage();
  attachDiagnostics(unavailableRoadPage, "road-distance-unavailable", {
    isExpectedHttpError: (response) => {
      const responseUrl = new URL(response.url());
      return response.status() === 503 && responseUrl.pathname === "/api/road-distance";
    },
    isExpectedConsoleError: (message) =>
      /^Failed to load resource: the server responded with a status of 503 \(Service Unavailable\)$/.test(
        message.text(),
      ),
  });
  await navigate(
    unavailableRoadPage,
    baseUrl,
    "road-distance-unavailable.idle",
  );
  await unavailableRoadPage.locator("#gyeol-place-search").fill("서울시청");
  await unavailableRoadPage
    .locator('form[role="search"]')
    .evaluate((form) => form.requestSubmit());
  await unavailableRoadPage
    .getByRole("heading", { name: "한양·한성부 권역 후보" })
    .waitFor({ state: "visible" });
  await unavailableRoadPage
    .getByRole("button", { name: "한성부 권역 지도 체험하기" })
    .click();
  await unavailableRoadPage
    .locator('[data-ready="true"][data-phase="arrived"]')
    .waitFor({ state: "attached", timeout: 30000 });
  await waitForRoadDistanceState(unavailableRoadPage, "unavailable");
  const unavailableDistanceComparison = unavailableRoadPage.locator(
    'dl[aria-label="현대 거리와 고지도 거리 비교"]',
  );
  report.desktop.unavailableModernDistanceMeters = Number(
    await unavailableDistanceComparison.getAttribute("data-modern-distance-meters"),
  );
  report.desktop.unavailableRoadStatus =
    await unavailableDistanceComparison.getAttribute("data-road-distance-status");
  report.desktop.unavailableRoadMeters =
    await unavailableDistanceComparison.getAttribute("data-road-distance-meters");
  report.desktop.unavailableRoadDuration =
    await unavailableDistanceComparison.getAttribute("data-road-duration-seconds");
  report.desktop.unavailableRoadMethod =
    await unavailableDistanceComparison.getAttribute("data-road-distance-method");
  report.desktop.unavailableDistanceRows = await unavailableDistanceComparison
    .locator("div")
    .evaluateAll((rows) =>
      rows.map((row) => ({
        term: row.querySelector("dt")?.textContent?.trim() ?? "",
        value: row.querySelector("dd")?.textContent?.trim() ?? "",
      })),
    );
  report.desktop.unavailableDistanceBasis = await unavailableRoadPage
    .getByText(/자동차 경로 현재 확인 불가/)
    .textContent();
  const unavailableProgress = unavailableRoadPage.getByRole("progressbar", {
    name: "실제 거리와 무관한 체험 경로 진행",
  });
  report.desktop.unavailableJourneyArrived = true;
  report.desktop.unavailableRouteStepCount = Number(
    await unavailableProgress.getAttribute("aria-valuemax"),
  );
  report.desktop.unavailableRouteProgressComplete =
    Number(await unavailableProgress.getAttribute("aria-valuenow")) ===
      report.desktop.unavailableRouteStepCount &&
    Number(await unavailableProgress.getAttribute("data-progress-percent")) === 100;
  report.desktop.unavailableRouteVectorPresent =
    (await unavailableRoadPage.locator('path[data-route-kind="step-dash"]').count()) === 2 &&
    (await unavailableRoadPage.locator('path[data-route-kind="reveal"]').count()) === 1;
  await capture(
    unavailableRoadPage,
    `service-road-distance-unavailable-${version}.png`,
    "road-distance-unavailable.arrived",
  );
  await unavailableRoadContext.close();

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
  await locationPage.waitForLoadState("networkidle", { timeout: 10000 });
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
    cheonanDefaultQuery:
      report.cheonan.desktop.defaultQuery === "천안역" &&
      report.cheonan.mobile.defaultQuery === "천안역",
    cheonanDefaultCard:
      /^첫 시범 위치\s*천안역 · 충청남도 천안시$/.test(
        report.cheonan.desktop.defaultPlaceCard ?? "",
      ),
    cheonanDefaultAction:
      report.cheonan.desktop.defaultActionVisible === true,
    cheonanSearchAndResult:
      report.cheonan.desktop.decodingPlace ===
        "천안역 · 충청남도 천안시 동남구 대흥로 239" &&
      report.cheonan.desktop.decodingBusy === true &&
      report.cheonan.desktop.resultHeading === "천안군 권역 후보" &&
      report.cheonan.desktop.resultFocus === "천안군 권역 후보" &&
      /충청남도 천안시 동남구 대흥로 239/.test(
        report.cheonan.desktop.inferenceText ?? "",
      ) &&
      /국가철도공단의 1905년 개업 기록/.test(
        report.cheonan.desktop.inferenceText ?? "",
      ),
    cheonanInferenceSources:
      JSON.stringify(report.cheonan.desktop.inferenceSources) ===
      JSON.stringify([
        {
          label:
            "한국철도공사 · 공공데이터포털 · 한국철도공사_역 위치 정보 · 천안역",
          href:
            "https://www.data.go.kr/data/15127532/fileData.do?recommendDataYn=Y",
          metadata:
            "데이터셋 15127532 · 접근일 2026.07.13 · 이용허락범위 제한 없음",
        },
        {
          label: "국가철도공단 · 공공데이터포털 · 철도역 정보 · 천안역",
          href: "https://www.data.go.kr/data/15067652/fileData.do",
          metadata:
            "데이터셋 15067652 · 접근일 2026.07.13 · 이용허락범위 제한 없음",
        },
        {
          label: "천안시 · 천안시 연혁 · 1416년 천안군",
          href: "https://www.cheonan.go.kr/kor/sub04_01_01.do",
          metadata:
            "공식 기록 cheonan-history-1416 · 접근일 2026.07.13 · 천안시 누리집 저작권 정책 적용 · 사실 확인용 출처",
        },
      ]),
    cheonanJourneyCta:
      report.cheonan.desktop.journeyButtonText ===
        "천안군 권역 판본 확대하기" &&
      report.cheonan.desktop.journeyButtonLabel === null,
    cheonanRegionalMap:
      report.cheonan.desktop.regionalMapReady === true &&
      report.cheonan.desktop.regionalMapLabel ===
        "대동여지도 공식 판본에서 천안군 권역 후보 확대" &&
      report.cheonan.desktop.zoomHeading === "천안 표기 판면 확대" &&
      report.cheonan.desktop.zoomHeadingVisible === true &&
      report.cheonan.desktop.coordinateWarning ===
        "현대 천안역과 옛 지도의 천안 표기는 같은 점이 아닙니다.",
    cheonanOfficialSheet:
      /\/assets\/official\/nmk-shinsu19997-cheonan-sheet-96-original\.jpg/.test(
        report.cheonan.desktop.officialSheetBackground ?? "",
      ),
    cheonanReturnedToResult:
      report.cheonan.desktop.returnedToResult === true,
    cheonanDesktopNoHorizontalOverflow: [
      report.cheonan.desktop.idleLayout,
      report.cheonan.desktop.resultLayout,
      report.cheonan.desktop.zoomLayout,
    ].every(hasNoHorizontalOverflow),
    cheonanMobileFlow:
      report.cheonan.mobile.resultHeadingVisible === true &&
      report.cheonan.mobile.journeyButtonVisible === true &&
      report.cheonan.mobile.zoomHeadingVisible === true &&
      report.cheonan.mobile.coordinateWarningVisible === true,
    cheonanMobileNoHorizontalOverflow: [
      report.cheonan.mobile.idleLayout,
      report.cheonan.mobile.resultLayout,
      report.cheonan.mobile.zoomLayout,
    ].every(hasNoHorizontalOverflow),
    cheonanRoadDistanceIsolation:
      report.cheonan.desktop.roadDistanceRequestCount === 0 &&
      report.cheonan.mobile.roadDistanceRequestCount === 0,
    desktopJourneyButton: report.desktop.journeyButtonVisible === true,
    desktopPublicDataExpanded: report.desktop.publicDataExpanded === true,
    desktopOfficialDoseongdo: /nmk-shinsu19997-doseongdo-original\.jpg/.test(
      report.desktop.officialDoseongdoSrc ?? "",
    ),
    desktopJourneyAssetsReady: report.desktop.journeyAssetsReady === true,
    desktopJourneyArrived: report.desktop.journeyArrived === true,
    desktopVectorRoute: report.desktop.routeIsVector === true,
    desktopStepDashRoute:
      report.desktop.routeUsesStepDashes === true &&
      report.desktop.routeStepCount === 30,
    desktopStepMarkers:
      report.desktop.routeMarkersMatch === true &&
      report.desktop.routeMarkersVisible === true &&
      JSON.stringify(report.desktop.routeMarkerSteps) === JSON.stringify([10, 20]),
    desktopRouteMeasure:
      report.desktop.routeMeasureVisible === true &&
      /한 획 = 체험 눈금 1칸/.test(report.desktop.routeMeasureText ?? "") &&
      /현대 좌표 직선거리\s*약 125km/.test(
        report.desktop.routeMeasureText ?? "",
      ) &&
      /현대 자동차 추천 경로\s*약 143km · 약 2시간 5분/.test(
        report.desktop.routeMeasureText ?? "",
      ) &&
      /고지도 노정 거리\s*현재 확인되지 않음/.test(
        report.desktop.routeMeasureText ?? "",
      ) &&
      /체험 30칸은 실제 거리 단위가 아닙니다/.test(
        report.desktop.routeMeasureText ?? "",
      ) &&
      /원본 대동여지도 도로는 10리마다 점/.test(
        report.desktop.routeMeasureText ?? "",
      ) &&
      !/체험 거리 1리/.test(report.desktop.routeMeasureText ?? ""),
    desktopModernDistance:
      Math.abs(report.desktop.modernDistanceMeters - 125142) <= 2 &&
      report.desktop.modernDistanceMethod === "great-circle" &&
      report.desktop.modernDistanceOrigin === "gongju-city-hall" &&
      report.desktop.modernDistanceDestination === "seoul-city-hall" &&
      report.desktop.modernDistanceText === "약 125km" &&
      /직선: 공주시청 ↔ 서울시청 좌표 기준 · 도로: 자동차 추천 경로\(교통상황에 따라 변동\)/.test(
        report.desktop.modernDistanceBasis ?? "",
      ),
    desktopRoadDistance:
      report.desktop.roadDistanceStatus === "success" &&
      report.desktop.roadDistanceMeters === 143321 &&
      report.desktop.roadDurationSeconds === 7502 &&
      report.desktop.roadDistanceMethod === "driving-route" &&
      JSON.stringify(report.desktop.distanceRows) ===
        JSON.stringify([
          { term: "현대 좌표 직선거리", value: "약 125km" },
          {
            term: "현대 자동차 추천 경로",
            value: "약 143km · 약 2시간 5분",
          },
          { term: "고지도 노정 거리", value: "현재 확인되지 않음" },
        ]),
    desktopDistanceCardClearsProgress:
      Boolean(
        report.desktop.routeMeasureLayout &&
          report.desktop.journeySceneLayout &&
          report.desktop.routeMeasureLayout.y +
            report.desktop.routeMeasureLayout.height <=
            report.desktop.journeySceneLayout.y +
              report.desktop.journeySceneLayout.height * 0.87,
      ),
    desktopAlternateModernDistance:
      Math.abs(report.desktop.alternateDistanceMeters - 126214) <= 2 &&
      report.desktop.alternateDistanceDestination === "gwanghwamun" &&
      report.desktop.alternateDistanceText === "약 126km" &&
      report.desktop.alternateDistanceLocation === "광화문" &&
      report.desktop.alternateRoadDistanceStatus === "success" &&
      report.desktop.alternateRoadDistanceMeters === 144987 &&
      report.desktop.alternateRoadDurationSeconds === 7812 &&
      report.desktop.alternateRoadDistanceMethod === "driving-route" &&
      report.desktop.alternateRoadDistanceText === "약 145km · 약 2시간 10분",
    desktopGrantedLocationDistance:
      Math.abs(report.desktop.grantedLocationDistanceMeters - 125142) <= 2 &&
      report.desktop.grantedLocationDistanceDestination === "seoul-city-hall" &&
      report.desktop.grantedLocationRoadStatus === "success" &&
      report.desktop.grantedLocationRoadMeters === 143321 &&
      report.desktop.grantedLocationRoadDurationSeconds === 7502 &&
      report.desktop.grantedLocationRoadMethod === "driving-route" &&
      /직선: 공주시청 ↔ 서울시청 좌표 기준 · 도로: 자동차 추천 경로\(교통상황에 따라 변동\)/.test(
        report.desktop.grantedLocationDistanceBasis ?? "",
      ),
    desktopRoadDistanceUnavailable:
      report.desktop.unavailableModernDistanceMeters === 125142 &&
      report.desktop.unavailableRoadStatus === "unavailable" &&
      report.desktop.unavailableRoadMeters === null &&
      report.desktop.unavailableRoadDuration === null &&
      report.desktop.unavailableRoadMethod === null &&
      JSON.stringify(report.desktop.unavailableDistanceRows) ===
        JSON.stringify([
          { term: "현대 좌표 직선거리", value: "약 125km" },
          { term: "현대 자동차 추천 경로", value: "현재 확인할 수 없음" },
          { term: "고지도 노정 거리", value: "현재 확인되지 않음" },
        ]) &&
      /자동차 경로 현재 확인 불가/.test(
        report.desktop.unavailableDistanceBasis ?? "",
      ) &&
      report.desktop.unavailableJourneyArrived === true &&
      report.desktop.unavailableRouteStepCount === 30 &&
      report.desktop.unavailableRouteProgressComplete === true &&
      report.desktop.unavailableRouteVectorPresent === true,
    desktopRouteProgress:
      report.desktop.routeProgressIncreases === true &&
      report.desktop.routeProgressStep > 0 &&
      report.desktop.routeProgressStep < report.desktop.routeProgressMax &&
      report.desktop.routeProgressPercent > 0 &&
      report.desktop.routeProgressPercent < 100 &&
      report.desktop.routeProgressPercent ===
        Math.round(
          (report.desktop.routeProgressStep / report.desktop.routeProgressMax) * 100,
        ) &&
      /칸 · \d+%/.test(report.desktop.routeProgressText ?? ""),
    desktopRouteRevealInProgress: report.desktop.routeRevealInProgress === true,
    desktopRouteRevealComplete: report.desktop.routeRevealComplete === true,
    desktopRouteProgressComplete: report.desktop.routeProgressComplete === true,
    desktopArrivalStep:
      report.desktop.routeStepCount === 30 &&
      report.desktop.arrivalStepText === "총 30칸",
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
    mobileRouteMeasure:
      report.mobile.routeMeasureVisible === true &&
      /한 획 = 체험 눈금 1칸/.test(report.mobile.routeMeasureText ?? "") &&
      /체험 30칸은 거리 아님/.test(report.mobile.routeMeasureText ?? ""),
    mobileModernDistance:
      Math.abs(report.mobile.modernDistanceMeters - 125142) <= 2 &&
      report.mobile.roadDistanceStatus === "success" &&
      report.mobile.roadDistanceMeters === 143321 &&
      report.mobile.roadDurationSeconds === 7502 &&
      report.mobile.roadDistanceMethod === "driving-route" &&
      JSON.stringify(report.mobile.distanceLines) ===
        JSON.stringify([
          "공주→서울 · 직선 약 125km",
          "자동차 약 143km · 약 2시간 5분",
          "고지도 미확인 · 체험 30칸은 거리 아님",
        ]) &&
      JSON.stringify(report.mobile.distanceLinesVisible) ===
        JSON.stringify([true, true, true]),
    mobileRouteProgressComplete:
      report.mobile.routeProgressComplete === true &&
      report.mobile.routeProgressMax === 30,
    mobileArrivalStep: report.mobile.arrivalStepText === "총 30칸",
    mobileArrived: Boolean(report.mobile.activeDoseongdoLocation),
    mobileDetailCreditDisclosure:
      report.mobile.detailCreditCollapsed === true &&
      report.mobile.detailCreditExpanded === true &&
      report.mobile.detailCreditRecollapsed === true,
    mobileNoHorizontalOverflow: [
      report.mobile.idleLayout,
      report.mobile.resultLayout,
    ].every(hasNoHorizontalOverflow),
    locationPermissionDenied: /위치 권한을 사용할 수 없습니다/.test(
      report.desktop.locationDeniedMessage ?? "",
    ),
    roadDistanceRequestsAreServerMediated:
      report.directProviderRequests.length === 0 &&
      report.clientKeyLeakFindings.length === 0,
    expectedRoadDistanceFallbackOnly:
      report.expectedHttpErrors.length === 1 &&
      report.expectedConsoleErrors.length === 1 &&
      /^\[road-distance-unavailable\] Failed to load resource: the server responded with a status of 503 \(Service Unavailable\)$/.test(
        report.expectedConsoleErrors[0] ?? "",
      ) &&
      report.expectedHttpErrors[0]?.scope === "road-distance-unavailable" &&
      report.expectedHttpErrors[0]?.status === 503 &&
      new URL(report.expectedHttpErrors[0]?.url ?? baseUrl).pathname ===
        "/api/road-distance",
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
