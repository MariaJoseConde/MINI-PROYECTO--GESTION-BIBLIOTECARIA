import heroBibliotecaImg from '../assets/images/hero_biblioteca_moderna_1794572932466.jpg';
import planoSalasImg from '../assets/images/plano_salas_biblioteca_1794579087718.jpg';
import coleccionLiteraturaImg from '../assets/images/coleccion_literatura_1794572933153.jpg';
import coleccionCienciaImg from '../assets/images/coleccion_ciencia_cosmos_1794572933139.jpg';
import coleccionHistoriaImg from '../assets/images/coleccion_historia_archivo_1794572959897.jpg';
import catCienciaFiccionImg from '../assets/images/cat_ciencia_ficcion_1794573216945.jpg';
import catClasicosImg from '../assets/images/cat_clasicos_universales_1794573217963.jpg';
import catCuentoFilosofiaImg from '../assets/images/cat_cuento_filosofia_1794573218199.jpg';
import catDistopiaImg from '../assets/images/cat_distopia_politica_1794573218217.jpg';
import catFilosofiaPoliticaImg from '../assets/images/cat_filosofia_politica_1794573218797.jpg';
import catNarrativaLatamImg from '../assets/images/cat_narrativa_latinoamericana_1794573218744.jpg';
import catPoesiaEnsayoImg from '../assets/images/cat_poesia_ensayo_1794573219382.jpg';
import catRealismoMagicoImg from '../assets/images/cat_realismo_magico_1794573220009.jpg';
import coverDistopiaImg from '../assets/images/cover_distopia_ciencia_1794572935032.jpg';
import coverClasicosImg from '../assets/images/cover_realismo_clasicos_1794572935053.jpg';
import coverCosmosImg from '../assets/images/cover_cosmos_divulgacion_1794572934718.jpg';
import coverFilosofiaImg from '../assets/images/cover_filosofia_poesia_1794572935777.jpg';

export const LIBRARY_MEDIA = {
  heroBiblioteca: heroBibliotecaImg,
  planoSalas: planoSalasImg,
  coleccionLiteratura: coleccionLiteraturaImg,
  coleccionCiencia: coleccionCienciaImg,
  coleccionHistoria: coleccionHistoriaImg,
};

const EXACT_CATEGORY_BANNERS: Record<string, string> = {
  'ciencia ficción': catCienciaFiccionImg,
  'clásicos universales': catClasicosImg,
  'cuento y filosofía': catCuentoFilosofiaImg,
  'distopía y política': catDistopiaImg,
  'divulgación científica': coleccionCienciaImg,
  'historia y antropología': coleccionHistoriaImg,
  'historia y filosofía política': catFilosofiaPoliticaImg,
  'literatura general': coleccionLiteraturaImg,
  'narrativa latinoamericana': catNarrativaLatamImg,
  'poesía y ensayo': catPoesiaEnsayoImg,
  'realismo mágico': catRealismoMagicoImg,
};

export function resolveCategoryBannerArt(categoria: string): string {
  const norm = categoria.trim().toLowerCase();
  if (EXACT_CATEGORY_BANNERS[norm]) {
    return EXACT_CATEGORY_BANNERS[norm];
  }

  if (norm.includes('ficción')) return catCienciaFiccionImg;
  if (norm.includes('clásic')) return catClasicosImg;
  if (norm.includes('cuento') || norm.includes('filosof')) return catCuentoFilosofiaImg;
  if (norm.includes('distop')) return catDistopiaImg;
  if (norm.includes('divulg') || norm.includes('ciencia')) return coleccionCienciaImg;
  if (norm.includes('antropolog')) return coleccionHistoriaImg;
  if (norm.includes('polític') || norm.includes('historia')) return catFilosofiaPoliticaImg;
  if (norm.includes('latinoam')) return catNarrativaLatamImg;
  if (norm.includes('poesía') || norm.includes('ensayo')) return catPoesiaEnsayoImg;
  if (norm.includes('mágico')) return catRealismoMagicoImg;

  return coleccionLiteraturaImg;
}

export function resolveBookCoverArt(categoria: string, idLibro: number): string {
  const norm = categoria.toLowerCase();

  if (norm.includes('ciencia ficción')) return catCienciaFiccionImg;
  if (norm.includes('distopía')) return coverDistopiaImg;
  if (norm.includes('divulgación')) return coverCosmosImg;
  if (norm.includes('cuento') || norm.includes('filosofía')) return coverFilosofiaImg;
  if (norm.includes('realismo mágico')) return coverClasicosImg;
  if (norm.includes('clásicos')) return catClasicosImg;
  if (norm.includes('narrativa latinoamericana')) return catNarrativaLatamImg;
  if (norm.includes('poesía')) return catPoesiaEnsayoImg;
  if (norm.includes('antropología')) return coleccionHistoriaImg;
  if (norm.includes('política')) return catFilosofiaPoliticaImg;

  const cycle = [coverClasicosImg, coverDistopiaImg, coverCosmosImg, coverFilosofiaImg];
  return cycle[Math.abs(idLibro) % cycle.length];
}
