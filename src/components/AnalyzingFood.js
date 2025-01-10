import { useState, useEffect } from 'react';
import { Typography } from '@mui/material';

const phrases = [
  "analizando tu plato...",
  "rebanando la imagen...",
  "sazonando los datos...",
  "anotando ingredientes...",
  "aliñando el resultado...",
  "midiendo cantidades...",
  "probando el punto de coción...",
  "comprobando temperatura...",
  "corrigiendo de sal y pimienta...",
  "añadiendo más harina..."
];

function AnalyzingFood() {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const intervalTime = 3000; // 3 segundos

  useEffect(() => {
    const phraseInterval = setInterval(() => {
      setCurrentPhraseIndex(prev => (prev + 1) % phrases.length);
    }, intervalTime);

    return () => clearInterval(phraseInterval);
  }, []);

  return (
    <Typography variant="h6" align="center">
      {phrases[currentPhraseIndex]}
    </Typography>
  );
}

export default AnalyzingFood; 