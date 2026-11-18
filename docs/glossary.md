---
type: Glossary
title: Inventory glossary
description: The trade words in stock, purchasing and production files, each with the mistake an import makes with it.
tags: [inventory, import, units, money]
---

# Inventory glossary

What each word means in a stock, purchasing or production file, then the mistake an import makes with it.

## Items

- **Item (SKU)**: one thing you stock, buy, make or sell. Mistake: two pack sizes merged, or one item split by a code.
- **Item code**: the item's stable identifier. Mistake: matching on the name, which breaks on any spelling change.
- **Variant, option**: one buyable combination (M, red); what variants differ on. Mistake: "Red / L" left in the name.
- **Non-stock item**: a line with no stock, such as freight or labour. Mistake: quantities imported for it.
- **Kit**: a set picked from stock and sold together. Mistake: treated as a bill of materials, which makes something.
- **Name, description**: a label and a longer text. Mistake: a "Description" column that the file uses as the name.
- **Category**: a grouping, often a path ("Food > Dairy"). Mistake: levels lost, or each level made a category.
- **Barcode** (GTIN, EAN, UPC). Mistake: stored as a number, losing leading zeros; the each's barcode reused for a case.

## Units and packs

- **Unit of measure**: what a quantity counts (each, kg, litre). Mistake: case counts put on an item stocked in eaches.
- **Base unit**: the one unit an item's stock is held in. Mistake: the case price entered as the each price.
- **Conversion factor (pack size)**: base units per purchase or sales unit. Mistake: inverted (1/12), or "12 x 500 ml"
  read as 12 litres.
- **Each, inner, case, pallet**: nested pack levels. Mistake: one case size assumed for every item.
- **Catch weight**: counted in pieces, priced by real weight. Mistake: converted with an average weight.
- **Quantity with its unit**: "12 cs", "2,5 kg". Mistake: the unit dropped, or "2,5" read as 25.

## Places and stock

- **Warehouse, bin**: a place that holds stock, a slot in it. Mistake: two warehouses added into one quantity.
- **Transfer, in transit**: stock moving between places. Mistake: counted at both ends, or at neither.
- **On hand, committed, available**: present; promised to orders; what is left, usually calculated. Mistake:
  "available" imported as on hand, or committed subtracted twice.
- **Incoming (on order)**: ordered, not yet received. Mistake: added into on hand.
- **Opening stock**: quantity and value on the start date. Mistake: no cost, so the stock is worth zero.
- **Stock count**: a physical count compared with the records. Mistake: counts from different days taken as one.
- **Negative stock**: a book quantity below zero. Mistake: silently set to zero instead of flagged.
- **Lot (batch), serial number**: units made or received together; one single unit. Mistake: a lot used as the item
  code, or a serial with a quantity above 1. Tracking by lot or serial is hard to change later: never set it casually.
- **Expiry date**: the last usable date of a lot. Mistake: day and month swapped.
- **Quarantine (on hold)**: present, not usable until inspected. Mistake: counted as available.

## Buying and making

- **Supplier**: who you buy from. Mistake: matched by name, so spelling variants become two suppliers.
- **Supplier or manufacturer part number**: their code for your item. Mistake: used as your own item code.
- **Purchase order, receipt**: what was ordered; what arrived, often in parts. Mistake: an order counted as stock.
- **Lead time, minimum order, reorder point**: three different numbers. Mistake: weeks stored as days, or swapped.
- **Landed cost**: price plus freight, duty and fees. Mistake: only the invoice price imported.
- **Bill of materials**: the components to make one unit or one batch. Mistake: a batch quantity read as per unit.
- **Yield, scrap**: good output over input; the expected loss. Mistake: a yield entered as a scrap percentage.

## Money

- **Cost, price**: what you pay; what you charge. Mistake: the two columns swapped.
- **Valuation**: standard, average or first-in-first-out cost. Mistake: last purchase price imported as average.
- **Inventory value**: quantity times unit cost. Mistake: a unit cost imported as a total, or the reverse.
- **Currency**: what a price is in. Mistake: currencies mixed in one column, or added into one total.
- **Tax-inclusive price**: price with sales tax in it. Mistake: gross prices imported as net.
- **Rates, discounts**: "5%", "5" or "0.05". Mistake: 5 read as 500%, or an amount read as a percentage.

## In the file

- **Header row**: not always row 1. Mistake: title or instruction rows read as data.
- **Match key**: the column that finds existing records. Mistake: a field that is not unique, such as a name.
- **Create or update**: a row makes a record or changes one. Mistake: duplicates made, or new rows skipped.
- **Blank cell**: "leave as is" in some systems, "clear it" in others. Mistake: the wrong reading wipes good data.
- **Duplicate rows**: one record twice. Mistake: the first or last kept without saying so.
- **Number format**: comma or point as the decimal mark. Mistake: "1.234" read as 1.234 when it means 1234.
- **Date format**: day first or month first. Mistake: 03/04 guessed; check whether any day is above 12.
- **Yes and no**: TRUE, Yes, Y, 1 or a word. Mistake: anything but "true" read as false.
- **Leading zeros**: codes that look like numbers. Mistake: "00123" becomes 123, a long code "1.23E+12".
- **Rejected rows**: the rows that failed, with reasons. Mistake: only counted, never returned for correction.
- **Audit trail**: which file, row and decision made each change. Mistake: a change nobody can trace or undo.
