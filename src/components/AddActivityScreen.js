import { 
  Button, 
  Dialog,
  DialogContent,
  DialogActions,
  Stack,
  DialogTitle,
  TextField
} from '@mui/material';
import { 
  Edit,
  LocalFireDepartment
} from '@mui/icons-material';
import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

function AddActivityScreen({ open, onClose, currentDate, onActivityAdded }) {
  const [isNameCaloriesDialogOpen, setIsNameCaloriesDialogOpen] = useState(false);
  const [activityName, setActivityName] = useState('');
  const [activityCalories, setActivityCalories] = useState('');

  const handleNameAndCaloriesClick = () => {
    setIsNameCaloriesDialogOpen(true);
  };

  const handleManualClick = () => {
    console.log('Introducción manual');
  };

  const handleNameCaloriesClose = () => {
    setIsNameCaloriesDialogOpen(false);
    setActivityName('');
    setActivityCalories('');
    onClose();
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
      
      // Notificar que se ha añadido una actividad
      onActivityAdded();
      handleNameCaloriesClose();
    } catch (error) {
      console.error('Error saving activity:', error);
      // Aquí podrías añadir manejo de errores
    }
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
    </>
  );
}

export default AddActivityScreen; 