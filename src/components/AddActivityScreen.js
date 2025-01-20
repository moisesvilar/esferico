import { 
  Button, 
  Dialog,
  DialogContent,
  DialogActions,
  Stack,
  DialogTitle,
  TextField,
  Typography,
  Box
} from '@mui/material';
import { 
  Edit,
  LocalFireDepartment
} from '@mui/icons-material';
import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

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

function AddActivityScreen({ open, onClose, currentDate, onActivityAdded }) {
  const [isNameCaloriesDialogOpen, setIsNameCaloriesDialogOpen] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [activityName, setActivityName] = useState('');
  const [activityCalories, setActivityCalories] = useState('');
  const [manualText, setManualText] = useState('');
  const [shouldCloseMain, setShouldCloseMain] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Efecto para manejar el cierre del diálogo principal
  useEffect(() => {
    if (shouldCloseMain) {
      onClose();
      setShouldCloseMain(false);
    }
  }, [shouldCloseMain, onClose]);

  const handleNameAndCaloriesClick = () => {
    setIsNameCaloriesDialogOpen(true);
  };

  const handleManualClick = () => {
    setIsManualDialogOpen(true);
  };

  const handleManualClose = () => {
    setManualText('');
    setIsManualDialogOpen(false);
    setShouldCloseMain(true);
  };

  const handleManualSave = async () => {
    try {
      setIsProcessing(true);
      
      const requestData = {
        instructions: manualText.trim()
      };

      const response = await fetchWithRetry(
        'https://hook.eu2.make.com/pmznjrcyzoc18xo4v7vvc4c44zygkxq6',
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
      console.log('JSON parseado:', parsedResponse);

      // Crear documento para Firestore
      const activityDoc = {
        name: parsedResponse.name,
        kcal: parsedResponse.kcal,
        date: currentDate.toISOString(),
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      };

      // Guardar en Firestore
      await addDoc(collection(db, 'activities'), activityDoc);
      
      // Notificar que se ha añadido una actividad para actualizar la lista y los totales
      onActivityAdded();

      setManualText('');
      setIsManualDialogOpen(false);
      setShouldCloseMain(true);
    } catch (error) {
      console.error('Error al procesar la actividad:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNameCaloriesClose = () => {
    setActivityName('');
    setActivityCalories('');
    setIsNameCaloriesDialogOpen(false);
    setShouldCloseMain(true);
  };

  const handleNameCaloriesSave = async () => {
    try {
      const activityDoc = {
        name: activityName.trim(),
        kcal: Number(activityCalories),
        date: currentDate.toISOString(),
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'activities'), activityDoc);
      
      onActivityAdded();
      setActivityName('');
      setActivityCalories('');
      setIsNameCaloriesDialogOpen(false);
      setShouldCloseMain(true);
    } catch (error) {
      console.error('Error saving activity:', error);
    }
  };

  // Añadir ref para el TextField
  const textFieldRef = useRef(null);

  // Añadir función para hacer scroll
  const handleTextFieldFocus = () => {
    setTimeout(() => {
      textFieldRef.current?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'center'
      });
    }, 100); // pequeño delay para asegurar que el teclado se ha desplegado
  };

  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose}
        fullWidth
        maxWidth="md"
      >
        <DialogContent>
          <Stack spacing={2}>
            <Button
              variant="contained"
              startIcon={<LocalFireDepartment />}
              onClick={handleNameAndCaloriesClick}
              fullWidth
            >
              Introducción por nombre y calorías
            </Button>
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={handleManualClick}
              fullWidth
            >
              Introducción manual
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isNameCaloriesDialogOpen}
        onClose={handleNameCaloriesClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Introducir actividad
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              autoFocus
              label="Nombre de la actividad"
              fullWidth
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              placeholder="Ej: correr"
            />
            <TextField
              type="number"
              label="Calorías consumidas"
              fullWidth
              value={activityCalories}
              onChange={(e) => setActivityCalories(e.target.value)}
              inputProps={{
                min: 0,
                step: 1
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleNameCaloriesClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleNameCaloriesSave}
            variant="contained"
            disabled={!activityName.trim() || !activityCalories}
          >
            Aceptar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isManualDialogOpen}
        onClose={handleManualClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Añadir actividad
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">
              Utiliza el cuadro de texto para añadir manualmente una actividad. Por ejemplo:
            </Typography>
            <Box 
              component="ul" 
              sx={{ 
                pl: 2, 
                mt: 1,
                typography: 'body2'
              }}
            >
              <li>"Correr 1 hora"</li>
              <li>"Aerobic 45 min"</li>
              <li>"Pesas 1h30m"</li>
            </Box>
            <TextField
              autoFocus
              fullWidth
              multiline
              rows={4}
              placeholder="Introduce aquí las instrucciones"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              ref={textFieldRef}
              onFocus={handleTextFieldFocus}
              sx={{ mb: 2 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleManualClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleManualSave}
            variant="contained"
            disabled={!manualText.trim() || isProcessing}
          >
            {isProcessing ? 'Procesando...' : 'Aceptar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default AddActivityScreen; 