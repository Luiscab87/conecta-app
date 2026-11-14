
import fs from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;

const BUCKET = 'avatars';

const DESTINO =
  'C:/Users/Usuario/Conecta-Backups/storage/avatars';

const archivos = [
  '44e15975-2ac9-41ae-8117-59f0a068f562/avatar.jpg',
  '6d2e178f-b20c-49af-a72b-7a705885cb7d/avatar.jpg',
  'a7702b75-15bf-4c44-ae77-42f557c74579/avatar.jpg'
];

async function iniciar() {
  try {
    if (!SUPABASE_URL) {
      throw new Error('No se encontró VITE_SUPABASE_URL');
    }

    await fs.mkdir(DESTINO, { recursive: true });

    console.log('Iniciando descarga de los avatares...\n');

    let descargados = 0;

    for (const archivo of archivos) {
      const rutaURL = archivo
        .split('/')
        .map(encodeURIComponent)
        .join('/');

      const url =
        `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${rutaURL}`;

      const respuesta = await fetch(url);

      if (!respuesta.ok) {
        throw new Error(
          `No se pudo descargar ${archivo}. HTTP ${respuesta.status}`
        );
      }

      const contenido = Buffer.from(
        await respuesta.arrayBuffer()
      );

      const destino = path.join(DESTINO, archivo);

      await fs.mkdir(path.dirname(destino), {
        recursive: true
      });

      await fs.writeFile(destino, contenido);

      descargados++;

      console.log(
        `Descargado: ${archivo} (${contenido.length} bytes)`
      );
    }

    console.log(`\nRespaldo terminado: ${descargados} de ${archivos.length} archivos.`);
    console.log(`Ubicación: ${DESTINO}`);

  } catch (error) {
    console.error('\nError:', error.message);
    process.exitCode = 1;
  }
}

iniciar();
