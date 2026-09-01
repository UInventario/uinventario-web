import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export async function expectAccessible(page: Page, context: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.map(({ id, impact, help, nodes }) => ({
    id,
    impact,
    help,
    targets: nodes.map(({ target }) => target.join(' ')),
  }));

  expect(blocking, `${context} debe cumplir WCAG A/AA`).toEqual([]);
}

export async function expectViewportFit(page: Page, context: string): Promise<void> {
  const fit = await page.evaluate(() => {
    const root = document.documentElement;
    const viewportWidth = root.clientWidth;
    const regions = ['.topbar', 'ui-ribbon', '.workspace-layout', '#workspace-content']
      .map((selector) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return null;
        const bounds = element.getBoundingClientRect();
        return { selector, left: bounds.left, right: bounds.right };
      })
      .filter((value) => value !== null);
    return { documentOverflow: root.scrollWidth - viewportWidth, viewportWidth, regions };
  });

  expect(fit.documentOverflow, `${context} no debe desbordar horizontalmente`).toBeLessThanOrEqual(
    1,
  );
  for (const region of fit.regions) {
    expect(region.left, `${region.selector} no debe salir por la izquierda`).toBeGreaterThanOrEqual(
      -1,
    );
    expect(region.right, `${region.selector} no debe salir por la derecha`).toBeLessThanOrEqual(
      fit.viewportWidth + 1,
    );
  }
}

export async function expectMinimumTargetSize(
  page: Page,
  selector: string,
  context: string,
  minimum = 24,
): Promise<void> {
  const undersized = await page.locator(selector).evaluateAll(
    (elements, min) =>
      elements
        .filter((element) => {
          const style = getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          return style.visibility !== 'hidden' && style.display !== 'none' && bounds.width > 0;
        })
        .map((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            label:
              element.getAttribute('aria-label') ?? element.textContent?.trim() ?? element.tagName,
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
          };
        })
        .filter(({ width, height }) => width < min || height < min),
    minimum,
  );

  expect(undersized, `${context} debe ofrecer objetivos táctiles de ${minimum}px`).toEqual([]);
}

export async function expectNoOverlap(
  page: Page,
  firstSelector: string,
  secondSelector: string,
  context: string,
): Promise<void> {
  const overlap = await page.evaluate(
    ({ firstSelector, secondSelector }) => {
      const first = document.querySelector<HTMLElement>(firstSelector)?.getBoundingClientRect();
      const second = document.querySelector<HTMLElement>(secondSelector)?.getBoundingClientRect();
      if (!first || !second) return null;
      return {
        horizontal: Math.max(
          0,
          Math.min(first.right, second.right) - Math.max(first.left, second.left),
        ),
        vertical: Math.max(
          0,
          Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top),
        ),
      };
    },
    { firstSelector, secondSelector },
  );

  expect(overlap, `${context} debe renderizar ambos controles`).not.toBeNull();
  expect(
    overlap ? overlap.horizontal * overlap.vertical : 0,
    `${context} no debe superponer controles`,
  ).toBeLessThanOrEqual(1);
}
