import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:5187/";
const outputDir = "tmp/qa";
const version = process.argv[2] ?? "v2";

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = {
  desktop: {},
  mobile: {},
  consoleErrors: [],
  pageErrors: [],
  failedRequests: []
};
const requestedUrls = [];

function attachDiagnostics(page) {
  page.on("request", (request) => requestedUrls.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText });
  });
}

async function waitForImages(page) {
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
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
        height: Math.round(box.height)
      };
    };

    const rectByText = (selector, text) => {
      const node = Array.from(document.querySelectorAll(selector)).find((element) =>
        element.textContent?.includes(text)
      );
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height)
      };
    };

    return {
      viewport: { width: innerWidth, height: innerHeight },
      scroll: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight
      },
      search: rect('form[role="search"]'),
      location: rectByText("button", "현재 위치 사용"),
      map: rect("figure"),
      panel: rect('section[aria-live="off"]'),
      progress: rect('nav[aria-label="서비스 진행 단계"]')
    };
  });
}

const desktopContext = await browser.newContext({
  viewport: { width: 1487, height: 1058 },
  deviceScaleFactor: 1,
  colorScheme: "light",
  reducedMotion: "no-preference"
});
const page = await desktopContext.newPage();
attachDiagnostics(page);

await page.goto(baseUrl, { waitUntil: "networkidle" });
await waitForImages(page);
report.desktop.idleLayout = await getLayout(page);
await page.screenshot({ path: `${outputDir}/service-idle-${version}.png`, fullPage: true });

report.desktop.tabOrder = [];
for (let index = 0; index < 5; index += 1) {
  await page.keyboard.press("Tab");
  report.desktop.tabOrder.push(
    await page.evaluate(() => ({
      tag: document.activeElement?.tagName ?? "",
      text:
        document.activeElement?.getAttribute("aria-label") ??
        document.activeElement?.textContent?.replace(/\s+/g, " ").trim() ??
        ""
    }))
  );
}

await page.getByRole("button", { name: "서울시청 예시로 해독하기" }).click();
await page.waitForTimeout(850);
report.desktop.decodingLayout = await getLayout(page);
await page.screenshot({ path: `${outputDir}/service-decoding-${version}.png`, fullPage: true });

await page.getByRole("heading", { name: "한양·한성부 권역 후보" }).waitFor({ state: "visible" });
report.desktop.resultLayout = await getLayout(page);
report.desktop.resultFocus = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
report.desktop.journeyButtonVisible = await page
  .getByRole("button", { name: "한성부 권역 지도 체험하기" })
  .isVisible();
await page.screenshot({ path: `${outputDir}/service-result-${version}.png`, fullPage: true });

const sourceLink = page.getByRole("link", { name: /국립중앙박물관 · 대동여지도/ }).first();
report.desktop.sourceLink = await sourceLink.getAttribute("href");
report.desktop.deliveryState = await page
  .getByText(/^(API 갱신 저장본|공식 원문 검수본)$/)
  .first()
  .textContent();
report.desktop.mapRegistration = await page
  .getByText("로컬 좌표 임시 등록", { exact: true })
  .textContent();
const publicDataSummary = page.getByText(
  /^(대동여지도 API 저장본|전국 박물관 유물정보_GW 연결 정보)$/
);
await publicDataSummary.click();
report.desktop.publicDataExpanded = await publicDataSummary.locator("xpath=ancestor::details").getAttribute("open");
report.desktop.publicDataStatus = await page
  .getByText(/^(공공데이터 저장본|API 연결 준비)$/)
  .textContent();

await page.getByRole("button", { name: "한성부 권역 지도 체험하기" }).click();
await page.getByRole("button", { name: "근거 결과로 돌아가기" }).waitFor({ state: "visible" });
report.desktop.officialDoseongdoSrc = await page
  .getByRole("img", { name: /대동여지도 신유본 중 도성도/ })
  .getAttribute("src");
report.desktop.routeIsVector =
  (await page.locator('svg[viewBox="0 0 1487 1058"] path').count()) === 2;
await page.waitForTimeout(2200);
await page.screenshot({ path: `${outputDir}/service-journey-${version}.png`, fullPage: true });

const skipButton = page.getByRole("button", { name: "이동 건너뛰기" });
if (await skipButton.isVisible()) {
  await skipButton.click();
  await page.waitForTimeout(350);
  report.desktop.detailSourceLink = await page
    .getByRole("link", { name: /국립중앙박물관 「대동여지도」 신수19997 \(새 창\)/ })
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
  await page.screenshot({ path: `${outputDir}/service-journey-arrived-${version}.png`, fullPage: true });
}

await page.getByRole("button", { name: "근거 결과로 돌아가기" }).click();
await page.getByRole("heading", { name: "한양·한성부 권역 후보" }).waitFor({ state: "visible" });
report.desktop.returnedToResult = true;

await page.getByRole("button", { name: "다른 위치 찾기" }).click();
await page.locator("#gyeol-place-search").fill("부산역");
await page.locator('form[role="search"]').evaluate((form) => form.requestSubmit());
const alert = page.getByRole("alert");
await alert.waitFor({ state: "visible" });
report.desktop.unsupportedMessage = (await alert.textContent())?.replace(/\s+/g, " ").trim();
await page.screenshot({ path: `${outputDir}/service-unsupported-${version}.png`, fullPage: true });

await page.goto(`${baseUrl}?legacy=1`, { waitUntil: "networkidle" });
await waitForImages(page);
report.desktop.legacyAvailable = await page
  .getByRole("button", { name: "가운데 대동여지도에서 한성부를 선택해 여정을 시작하기" })
  .isVisible();
await page.screenshot({ path: `${outputDir}/service-legacy-${version}.png`, fullPage: true });

await desktopContext.close();

const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  colorScheme: "light",
  reducedMotion: "reduce"
});
const mobilePage = await mobileContext.newPage();
attachDiagnostics(mobilePage);

await mobilePage.goto(baseUrl, { waitUntil: "networkidle" });
await waitForImages(mobilePage);
report.mobile.idleLayout = await getLayout(mobilePage);
await mobilePage.screenshot({ path: `${outputDir}/service-mobile-idle-${version}.png`, fullPage: true });

await mobilePage.getByRole("button", { name: "서울시청 예시로 해독하기" }).click();
await mobilePage.getByRole("heading", { name: "한양·한성부 권역 후보" }).waitFor({ state: "visible" });
report.mobile.resultLayout = await getLayout(mobilePage);
report.mobile.journeyButtonVisible = await mobilePage
  .getByRole("button", { name: "한성부 권역 지도 체험하기" })
  .isVisible();
await mobilePage.screenshot({ path: `${outputDir}/service-mobile-result-${version}.png`, fullPage: true });

await mobilePage.getByRole("button", { name: "한성부 권역 지도 체험하기" }).click();
await mobilePage.getByRole("button", { name: "근거 결과로 돌아가기" }).waitFor({ state: "visible" });
await mobilePage.locator('figure[aria-labelledby="doseongdo-korean-title"]').waitFor({
  state: "visible"
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
      height: Math.round(box.height)
    };
  });
report.mobile.activeDoseongdoLocation = await mobilePage
  .locator('li[aria-current="location"] strong')
  .textContent();
await mobilePage.screenshot({
  path: `${outputDir}/service-mobile-journey-arrived-${version}.png`,
  fullPage: true
});

await mobileContext.close();

const locationContext = await browser.newContext({ viewport: { width: 1487, height: 1058 } });
const locationPage = await locationContext.newPage();
attachDiagnostics(locationPage);
await locationPage.goto(baseUrl, { waitUntil: "networkidle" });
await locationPage.getByRole("button", { name: "현재 위치 사용" }).click();
const locationAlert = locationPage.getByRole("alert");
await locationAlert.waitFor({ state: "visible", timeout: 10000 });
report.desktop.locationDeniedMessage = (await locationAlert.textContent())?.replace(/\s+/g, " ").trim();
await locationPage.screenshot({ path: `${outputDir}/service-location-denied-${version}.png`, fullPage: true });
await locationContext.close();

await browser.close();

report.clientKeyLeak = requestedUrls.some((url) => /(?:serviceKey|DATA_GO_KR_SERVICE_KEY)/i.test(url));

await writeFile(`${outputDir}/playwright-report-${version}.json`, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
