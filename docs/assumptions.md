# Design assumptions

## Loss drift

Drift uses the **population standard deviation** of the earlier closed jobs for
the same karigar, with a **20 bp floor**. An alert is raised when **z >= 2**
and the latest loss is **at least 50 bp above the mean**.

## Daily stock statement

- **A-S1:** The statement answers where all fine gold is at the end of a chosen date: vault, with karigars, at refiner, and written-off wastage.
- **A-S2:** Vault-level movements are OPENING, REFINER_SEND, and REFINER_RETURN. Ledger entries cover issues and receipts.
- **A-S3:** All stock arithmetic uses integer BigInt milligrams. Open-job balances, closed-job losses, refiner balance, and vault balance reconcile back to opening stock.

## Karigar balance

The canonical karigar balance is the sum of `(issued fine - received fine)` for
jobs open at the requested as-of date. Closed-job leftovers are written-off
loss and are never included in the balance.
