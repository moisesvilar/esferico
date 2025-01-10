import { useState } from 'react';
import { 
  Button, 
  Typography, 
  Dialog,
  DialogContent,
  DialogActions,
  Stack
} from '@mui/material';
import { 
  PhotoCamera, 
  PhotoLibrary, 
  Edit, 
  ArrowBack 
} from '@mui/icons-material';
import AnalyzingFood from './AnalyzingFood';

function AddFoodScreen({ open, onClose, onImageAnalyzed }) {
  const [step, setStep] = useState('initial');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const analyzeImageWithRetry = async (image, maxRetries = 5) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Intento ${attempt} de ${maxRetries}...`);
        
        const formData = new FormData();
        formData.append('image', image);

        const response = await fetch('https://hook.eu2.make.com/d2j15f81g7x85o1mfl2crku1ruulqzul', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const rawText = await response.text();
        let cleanText = rawText
          .replace(/```json\n/, '')
          .replace(/\n```/, '')
          .trim();

        const data = JSON.parse(cleanText);
        return data;
        
      } catch (error) {
        console.error(`Error en intento ${attempt}:`, error);
        
        if (attempt === maxRetries) {
          throw error; // Si es el último intento, propagamos el error
        }
        
        // Esperar antes del siguiente intento (tiempo exponencial de espera)
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000); // máximo 10 segundos
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  };

  const handleImageSelected = async (image) => {
    setIsAnalyzing(true);
    try {
      const data = await analyzeImageWithRetry(image);
      onImageAnalyzed(image, data);
    } catch (error) {
      console.error('Error analyzing image after all retries:', error);
      setError('Error al analizar la imagen. Por favor, inténtalo de nuevo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCameraClick = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      
      input.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
          handleImageSelected(e.target.files[0]);
        }
      };
      
      input.click();
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const handleGalleryClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageSelected(e.target.files[0]);
      }
    };
    
    input.click();
  };

  const handlePhotoClick = () => {
    setStep('photo');
  };

  const handleClose = () => {
    setStep('initial');
    onClose();
  };

  const renderContent = () => {
    if (isAnalyzing) {
      return (
        <DialogContent>
          <AnalyzingFood />
        </DialogContent>
      );
    }

    if (error) {
      return (
        <DialogContent>
          <Typography color="error" align="center">
            {error}
          </Typography>
          <Button 
            onClick={() => setError(null)} 
            fullWidth 
            sx={{ mt: 2 }}
          >
            Intentar de nuevo
          </Button>
        </DialogContent>
      );
    }

    switch (step) {
      case 'photo':
        return (
          <>
            <DialogContent>
              <Stack spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<PhotoCamera />}
                  onClick={handleCameraClick}
                  fullWidth
                >
                  Sacar una foto
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PhotoLibrary />}
                  onClick={handleGalleryClick}
                  fullWidth
                >
                  Elegir de la galería
                </Button>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setStep('initial')} startIcon={<ArrowBack />}>
                Volver
              </Button>
            </DialogActions>
          </>
        );

      default: // 'initial'
        return (
          <>
            <DialogContent>
              <Stack spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<PhotoCamera />}
                  onClick={handlePhotoClick}
                  fullWidth
                >
                  Analizar una foto
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Edit />}
                  fullWidth
                >
                  Introducción manual
                </Button>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose}>
                Cancelar
              </Button>
            </DialogActions>
          </>
        );
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      fullWidth
      maxWidth="md"
    >
      {renderContent()}
    </Dialog>
  );
}

export default AddFoodScreen; 