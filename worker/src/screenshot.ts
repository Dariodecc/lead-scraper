import sharp from "sharp";

// Limiti scelti per tenere il costo dei token immagine di gpt-4o-mini prevedibile e LIMITATO
// indipendentemente da quanto è lunga la pagina originale (una pagina di 10.000px verrebbe
// altrimenti tokenizzata a un costo enorme). OpenAI ridimensiona comunque a sua volta il lato
// corto a 768px per il calcolo dei tile — con questi bound l'immagine finale inviata resta al
// più ~768×1500px dopo quel passaggio -> 6 tile -> ~36.835 token gpt-4o-mini (vedi aiAnalysis.ts
// per il calcolo del costo reale, letto dagli usage.prompt_tokens restituiti da OpenAI).
export const SCREENSHOT_MAX_WIDTH = 1024;
export const SCREENSHOT_MAX_HEIGHT = 2000;

/** Ridimensiona uno screenshot (buffer PNG/JPEG) entro i bound sopra e lo ricodifica in JPEG. */
export async function resizeScreenshotForVision(buffer: Buffer): Promise<string> {
  const resized = await sharp(buffer)
    .resize({
      width: SCREENSHOT_MAX_WIDTH,
      height: SCREENSHOT_MAX_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 70 })
    .toBuffer();
  return resized.toString("base64");
}
