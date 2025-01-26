import { useState, useEffect } from 'react';
import { 
  Button, 
  Typography, 
  Dialog,
  DialogContent,
  DialogActions,
  Stack,
  DialogTitle,
  TextField,
  Box,
  Autocomplete
} from '@mui/material';
import { 
  PhotoCamera, 
  PhotoLibrary, 
  Edit, 
  ArrowBack,
  Star
} from '@mui/icons-material';
import AnalyzingFood from './AnalyzingFood';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth, db } from '../config/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import SparkMD5 from 'spark-md5';
import { startOfDay, endOfDay } from 'date-fns';

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

function AddFoodScreen({ open, onClose, onImageAnalyzed, currentDate }) {
  const [step, setStep] = useState('initial');
  const [error, setError] = useState(null);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isFavoritesDialogOpen, setIsFavoritesDialogOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [selectedFavorite, setSelectedFavorite] = useState(null);
  const [hasFavorites, setHasFavorites] = useState(false);

  // Cargar comidas favoritas al abrir el diálogo
  useEffect(() => {
    const fetchFavorites = async () => {
      if (!auth.currentUser) return;

      try {
        const favoritesQuery = query(
          collection(db, 'plates'),
          where('userId', '==', auth.currentUser.uid),
          where('isFavorite', '==', true)
        );

        const snapshot = await getDocs(favoritesQuery);
        const favoriteMeals = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setFavorites(favoriteMeals);
        setHasFavorites(favoriteMeals.length > 0);
      } catch (error) {
        console.error('Error fetching favorites:', error);
      }
    };

    if (open) {
      fetchFavorites();
    }
  }, [open]);

  const handleImageSelected = async (file) => {
    if (!file) {
      setError('No se ha seleccionado ninguna imagen');
      return;
    }

    // Validar el tipo y tamaño del archivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen válido');
      return;
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      setError('La imagen es demasiado grande. Máximo 10MB');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // Calcular hash de la imagen
      const imageHash = await calculateImageHash(file);

      // Buscar platos con el mismo hash del día actual
      const start = startOfDay(currentDate).toISOString();
      const end = endOfDay(currentDate).toISOString();
      
      const duplicatesQuery = query(
        collection(db, 'plates'),
        where('userId', '==', auth.currentUser.uid),
        where('imageHash', '==', imageHash),
        where('date', '>=', start),
        where('date', '<=', end)
      );

      const duplicatesSnapshot = await getDocs(duplicatesQuery);

      if (!duplicatesSnapshot.empty) {
        // Usar datos del plato existente
        const existingPlate = duplicatesSnapshot.docs[0].data();
        onImageAnalyzed(file, {
          ...existingPlate,
          description: `Copia de ${existingPlate.description}`,
          id: undefined,
          date: undefined,
          createdAt: undefined
        });
        setIsUploading(false);
        return;
      }

      // Subir la imagen a Firebase Storage
      const storageRef = ref(storage, `plates/${auth.currentUser.uid}/${Date.now()}.jpg`);
      const uploadResult = await uploadBytes(storageRef, file);

      // Obtener la URL de descarga
      const imageUrl = await getDownloadURL(uploadResult.ref);

      // Preparar los datos para el análisis
      const formData = new FormData();
      formData.append('image', file);
      formData.append('imageUrl', imageUrl);

      // Hacer la petición al servidor de análisis
      const response = await fetchWithRetry(
        'https://hook.eu2.make.com/d2j15f81g7x85o1mfl2crku1ruulqzul',
        {
          method: 'POST',
          body: formData
        }
      );

      const responseText = await response.text();
      const cleanJson = responseText
        .replace(/^```json\n/, '')
        .replace(/\n```$/, '')
        .trim();

      const analysisResult = JSON.parse(cleanJson);

      // Añadir la URL de la imagen al resultado del análisis
      const resultWithImage = {
        ...analysisResult,
        imageUrl,
        hasImage: true
      };

      // Notificar el resultado
      onImageAnalyzed(file, resultWithImage);

    } catch (error) {
      console.error('Error processing image:', error);
      setError(`Error al procesar la imagen: ${error.message}`);
      // Volver al paso de selección de foto
      setStep('photo');
    } finally {
      setIsUploading(false);
    }
  };

  const calculateImageHash = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsBinaryString(file);
      reader.onload = () => {
        const hash = SparkMD5.hash(reader.result);
        resolve(hash);
      };
    });
  };

  const handleCameraClick = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      
      // Asegurarnos que el evento change se dispara
      const handleChange = (e) => {
        if (e.target.files && e.target.files[0]) {
          handleImageSelected(e.target.files[0]);
        } else {
          setError('No se ha seleccionado ninguna imagen');
        }
        input.removeEventListener('change', handleChange);
      };
      
      input.addEventListener('change', handleChange);
      input.click();
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Error al acceder a la cámara. Por favor, inténtalo de nuevo');
    }
  };

  const handleGalleryClick = () => {
    try {
      const input = document.querySelector('input[type="file"]');
      if (!input) {
        throw new Error('No se encontró el input de archivo');
      }

      // Asegurarnos que el evento change se dispara
      const handleChange = (e) => {
        if (e.target.files && e.target.files[0]) {
          handleImageSelected(e.target.files[0]);
        } else {
          setError('No se ha seleccionado ninguna imagen');
        }
        input.removeEventListener('change', handleChange);
      };

      input.addEventListener('change', handleChange);
      input.click();
    } catch (error) {
      console.error('Error accessing gallery:', error);
      setError('Error al acceder a la galería. Por favor, inténtalo de nuevo');
    }
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

  const handleManualSubmit = async () => {
    if (!manualText.trim()) {
      setError('Por favor, introduce las instrucciones');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const requestData = {
        instructions: manualText.trim()
      };

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

      // Marcar que este plato fue creado manualmente
      const analysisWithFlag = {
        ...parsedResponse,
        isManualInput: true
      };

      onImageAnalyzed(null, analysisWithFlag);  // Pasar null como imagen y los datos con la flag
      handleClose();
    } catch (error) {
      console.error('Error:', error);
      setError('Error al procesar la comida. Por favor, inténtalo de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFavoriteClick = () => {
    setIsFavoritesDialogOpen(true);
  };

  const handleFavoriteClose = () => {
    setIsFavoritesDialogOpen(false);
    setSelectedFavorite(null);
  };

  const handleFavoriteSave = async () => {
    if (!selectedFavorite) return;

    try {
      // Crear una copia de la comida favorita con los campos necesarios
      const newMeal = {
        description: selectedFavorite.description,
        total_kcal: selectedFavorite.total_kcal,
        total_weight: selectedFavorite.total_weight,
        total_protein_weight: selectedFavorite.total_protein_weight,
        total_carbohydrates_weight: selectedFavorite.total_carbohydrates_weight,
        total_fats_weight: selectedFavorite.total_fats_weight,
        components: selectedFavorite.components,
        imageUrl: selectedFavorite.imageUrl,
        isFavorite: false,  // Cambiado: la nueva copia no será favorita
        date: currentDate.toISOString(),
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      };

      // Guardar directamente en Firestore
      await addDoc(collection(db, 'plates'), newMeal);
      
      // Cerrar diálogos y notificar
      handleFavoriteClose();
      onClose();
      onImageAnalyzed(null, null);
    } catch (error) {
      console.error('Error saving favorite meal:', error);
    }
  };

  const renderContent = () => {
    if (isUploading) {
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
                  data-testid="take-photo-button"
                  variant="contained"
                  startIcon={<PhotoCamera />}
                  onClick={handleCameraClick}
                  fullWidth
                >
                  Sacar una foto
                </Button>
                <Button
                  data-testid="gallery-button"
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
                {hasFavorites && (
                  <Button
                    variant="contained"
                    startIcon={<Star />}
                    onClick={handleFavoriteClick}
                    sx={{
                      bgcolor: '#FFC107',
                      '&:hover': {
                        bgcolor: '#FFA000'
                      }
                    }}
                    fullWidth
                  >
                    Entre tus favoritas
                  </Button>
                )}

                <Button
                  data-testid="photo-button"
                  variant="contained"
                  startIcon={<PhotoCamera />}
                  onClick={handlePhotoClick}
                  fullWidth
                >
                  Sacar una foto
                </Button>

                <Button
                  data-testid="manual-input-button"
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
      <input
        type="file"
        accept="image/*"
        onChange={(e) => handleImageSelected(e.target.files[0])}
        style={{ display: 'none' }}
        data-testid="file-input"
      />
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
            onClick={handleManualSubmit}
            variant="contained"
            disabled={!manualText.trim() || isProcessing}
          >
            {isProcessing ? 'Procesando...' : 'Aceptar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Nuevo diálogo para seleccionar favoritos */}
      <Dialog
        open={isFavoritesDialogOpen}
        onClose={handleFavoriteClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Seleccionar comida favorita
        </DialogTitle>
        <DialogContent>
          <Autocomplete
            options={favorites}
            getOptionLabel={(option) => option.description}
            value={selectedFavorite}
            onChange={(_, newValue) => setSelectedFavorite(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Buscar entre tus favoritos"
                fullWidth
                margin="normal"
              />
            )}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              
              return (
                <Box 
                  component="li" 
                  key={key}
                  {...otherProps}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    {option.imageUrl && (
                      <Box
                        component="img"
                        src={option.imageUrl}
                        alt={option.description}
                        sx={{ width: 40, height: 40, borderRadius: 1 }}
                      />
                    )}
                    <Stack>
                      <Typography>{option.description}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.total_weight}g · {option.total_kcal} kcal
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              );
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFavoriteClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleFavoriteSave}
            variant="contained"
            disabled={!selectedFavorite}
          >
            Aceptar
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

export default AddFoodScreen; 