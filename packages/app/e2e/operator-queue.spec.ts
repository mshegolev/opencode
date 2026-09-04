import { expect, test } from "@playwright/test"

test("an operator opens the queue, switches tab and reads a ready analysis", async ({ page }) => {
  await page.goto("/queue")

  // The default tab is what is assigned to the operator.
  await expect(page.getByRole("tab", { name: /На мне/ })).toHaveAttribute("aria-selected", "true")

  // Open an incident with a ready analysis by clicking it in the queue — this is the
  // connection the scenario exists to prove, not just that both routes render standalone.
  await page.getByRole("button", { name: /INC0048812/ }).click()
  await expect(page).toHaveURL(/\/queue\/INC0048812$/)
  await expect(page.getByText("Предполагаемая причина")).toBeVisible()
  await expect(page.getByText("Что не проверено")).toBeVisible()
  await expect(page.getByText(/Уверенность средняя/)).toBeVisible()
  await expect(page.getByText("Открыть тикет в ITSM")).toBeVisible()

  // Back to the queue, then the group tab, which announces what it hides.
  await page.goto("/queue")
  const groupTab = page.getByRole("tab", { name: /Очередь группы/ })
  await expect(groupTab).toContainText("готово")
  await groupTab.click()

  // A breached SLA counts up rather than resting at zero.
  await expect(page.getByText("−", { exact: false }).first()).toBeVisible()
})
