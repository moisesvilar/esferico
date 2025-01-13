import { useState } from 'react';
import { 
  Button, 
  Typography, 
  Dialog,
  DialogContent,
  DialogActions,
  Stack,
  DialogTitle,
  TextField,
  Box
} from '@mui/material';
import { 
  PhotoCamera, 
  PhotoLibrary, 
  Edit, 
  ArrowBack 
} from '@mui/icons-material';
import AnalyzingFood from './AnalyzingFood';

const PLACEHOLDER_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; // Imagen transparente 1x1

const fetchWithRetry = async (url, options, maxRetries = 5, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      
      if (attempt === maxRetries) {
        throw new Error(`Error en la llamada al servidor después de ${maxRetries} intentos: ${response.status} ${response.statusText}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
      
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
};

function AddFoodScreen({ open, onClose, onImageAnalyzed }) {
  const [step, setStep] = useState('initial');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const analyzeImageWithRetry = async (image, maxRetries = 5) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
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
        if (attempt === maxRetries) {
          throw error;
        }
        
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
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

  const handleManualDialogOpen = () => {
    setIsManualDialogOpen(true);
    setManualText('');
  };

  const handleManualDialogClose = () => {
    setIsManualDialogOpen(false);
    setManualText('');
  };

  const handleManualDialogSave = async () => {
    if (manualText.trim()) {
      setIsProcessing(true);
      
      const requestData = {
        instructions: manualText.trim()
      };

      try {
        const response = await fetchWithRetry(
          'https://hook.eu2.make.com/oopbrisdd2lvp1lgnnbxbixpu1p2sgew',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
          }
        );

        const responseText = await response.text();
        const cleanJson = responseText
          .replace(/^```json\n/, '')
          .replace(/\n```$/, '');

        const parsedResponse = JSON.parse(cleanJson);

        const response_img = await fetch(PLACEHOLDER_IMAGE);
        const blob = await response_img.blob();
        const placeholder_image = new File([blob], 'placeholder.png', { type: 'image/png' });

        onImageAnalyzed(placeholder_image, parsedResponse);

        handleManualDialogClose();
        handleClose();
      } catch (error) {
        console.error('Error al procesar la comida:', error);
        setError('Error al procesar la comida. Por favor, inténtalo de nuevo.');
      } finally {
        setIsProcessing(false);
      }
    }
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
                  onClick={handleManualDialogOpen}
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
      <Dialog
        open={isManualDialogOpen}
        onClose={handleManualDialogClose}
        fullWidth
        maxWidth="sm"
        disableEscapeKeyDown
      >
        <DialogTitle sx={{ typography: 'subtitle1', fontWeight: 'bold' }}>
          Añadir comida
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2">
              Utiliza el cuadro de texto para añadir manualmente una comida. Por ejemplo:
            </Typography>
            <Box 
              component="ul" 
              sx={{ 
                pl: 2, 
                mt: 1,
                typography: 'body2'
              }}
            >
              <li>"Un plato de crema de legumbres"</li>
              <li>"Una ensalada de brotes verdes con tomate"</li>
              <li>"Una tortilla francesa con cebolla"</li>
            </Box>
            <TextField
              autoFocus
              margin="dense"
              placeholder="Introduce aquí las instrucciones"
              fullWidth
              multiline
              rows={4}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleManualDialogClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleManualDialogSave}
            variant="contained"
            disabled={!manualText.trim() || isProcessing}
          >
            {isProcessing ? 'Procesando...' : 'Aceptar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

export default AddFoodScreen; 