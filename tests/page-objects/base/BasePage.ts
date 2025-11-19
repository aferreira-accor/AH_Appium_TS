export abstract class BasePage {
  protected async waitForElement(
    selector: string,
    timeout?: number
  ): Promise<void> {
    if (typeof timeout === "number") {
      await $(selector).waitForDisplayed({ timeout });
    } else {
      await $(selector).waitForDisplayed();
    }
  }

  protected async waitAndTap(selector: string, timeout?: number): Promise<void> {
    await this.waitForElement(selector, timeout);
    await $(selector).click();
  }

  protected async waitAndType(selector: string, text: string, timeout?: number): Promise<void> {
    await this.waitForElement(selector, timeout);
    await $(selector).clearValue();
    await $(selector).setValue(text);
  }

  protected async isElementVisible(
    selector: string,
    timeout?: number
  ): Promise<boolean> {
    try {
      const element = $(selector);
      if (typeof timeout === "number") {
        await element.waitForDisplayed({ timeout });
      } else {
        await element.waitForDisplayed();
      }
      return true;
    } catch {
      return false;
    }
  }

  protected async scrollToElement(selector: string): Promise<void> {
    const element = $(selector);
    await element.waitForExist();
    await element.scrollIntoView();
  }

  protected async scrollToElementLazy(
    selector: string,
    maxScrolls: number = 10
  ): Promise<void> {
    const element = $(selector);

    // First try: check if element already exists in DOM
    const exists = await element.isExisting();
    if (exists) {
      await element.scrollIntoView();
      return;
    }

    // Element is outside DOM, need to scroll to load it (iOS lazy loading)
    console.log(`Element not in DOM yet, performing lazy scroll...`);
    for (let i = 0; i < maxScrolls; i++) {
      // Check if element is now in DOM
      const nowExists = await element.isExisting();
      if (nowExists) {
        console.log(`✅ Element loaded into DOM after ${i} scroll(s)`);
        await element.scrollIntoView();
        return;
      }

      // Scroll down to load more content
      if (driver.isIOS) {
        await driver.execute("mobile: scroll", { direction: "down" });
      } else {
        // Android: swipe gesture
        const { width, height } = await driver.getWindowSize();
        await driver.touchAction([
          { action: "press", x: width / 2, y: height * 0.8 },
          { action: "moveTo", x: width / 2, y: height * 0.2 },
          "release",
        ]);
      }
      await driver.pause(500);
    }

    // Final attempt - wait for element
    console.log(
      `⚠️ Element still not found after ${maxScrolls} scrolls, doing final wait...`
    );
    await element.waitForExist({ timeout: 5000 });
    await element.scrollIntoView();
  }

  protected async takeScreenshot(name?: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = name ? `${name}_${timestamp}` : `screenshot_${timestamp}`;
    await driver.saveScreenshot(`./screenshots/${filename}.png`);
  }

  async getCurrentActivity(): Promise<string> {
    if (driver.isAndroid) {
      return await driver.getCurrentActivity();
    }
    return "";
  }

  async getCurrentPackage(): Promise<string> {
    if (driver.isAndroid) {
      return await driver.getCurrentPackage();
    }
    return "";
  }

  async pressBack(): Promise<void> {
    if (driver.isAndroid) {
      await driver.pressKeyCode(4); // KEYCODE_BACK
    }
  }

  async hideKeyboard(): Promise<void> {
    try {
      await driver.hideKeyboard();
    } catch {
      // Keyboard might not be visible
    }
  }
}
