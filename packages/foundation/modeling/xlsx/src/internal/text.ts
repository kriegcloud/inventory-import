// Which text a workbook's XML can carry. XML 1.0 has no way to write a control character other than a tab or a
// line break, a lone
// surrogate, U+FFFE or U+FFFF; cell text gets Excel's `_xHHHH_` escape for them (internal/writer.ts), while a sheet
// name, a formula and a format code have no escape and so may not hold them.
const unsafe = /[\u0000-\u001f￾￿]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/

/** Whether `text` can be written into a workbook part without an escape and read back unchanged. */
export const isXmlSafe = (text: string): boolean => !unsafe.test(text)
