# Signature

A local e-signature app. Open a PDF or Word document, drop ready-made signatures, initials, dates and text onto it, and download the signed PDF. Everything runs on your machine.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

- `npm run dev` starts the web app on port 5173 and a small helper server on port 3001.
- `npm start` builds the app and serves everything from http://127.0.0.1:3001.

Word files (`.docx`, `.doc`, `.odt`, `.rtf`) are converted to PDF with LibreOffice (`brew install --cask libreoffice`). PDFs open without it.

## How to use

1. Type your name in **Your details**. Six ready-made signature styles and matching initials appear in your chosen ink colour.
2. Click a signature (or a Name / Date / Text / ✓ field), then click on the page. You can also drag it onto the page.
3. Drag to move it, use the corner handle to resize, and press Delete or click × to remove it. Double-click a text field to edit it.
4. Use **+ Draw / upload** to draw a signature, type one in a chosen font, or upload a photo of your real signature (the white background is removed).
5. Click **Download signed PDF**.

Your name and saved signatures are kept in the browser's local storage.

## Layout

- `server/index.js`: Express server that converts Word files with LibreOffice
- `src/App.jsx`: document state, placing fields, download
- `src/components/`: sidebar, page renderer, draggable field box, signature creator
- `src/lib/sigImage.js`: turns typed text, drawings and photos into transparent PNGs
- `src/lib/exportPdf.js`: stamps fields onto the original PDF with pdf-lib

## Contributing

Issues and pull requests are welcome.

## License

[MIT](LICENSE). Signature fonts are bundled through [Fontsource](https://fontsource.org) and are licensed under the SIL Open Font License.
