import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  TextField,
  Stack,
  Paper
} from '@mui/material';
import { Check, Close } from '@mui/icons-material';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

function ActivityEditScreen({ activity, onCancel, onSuccess }) {
  const [activityData, setActivityData] = useState(activity);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await setDoc(doc(db, 'activities', activity.id), {
        ...activityData,
        kcal: Number(activityData.kcal)
      }, { merge: true });

      onSuccess();
    } catch (error) {
      console.error('Error saving activity:', error);
      setError('Error al guardar los datos');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 'md', mx: 'auto', p: 2 }}>
      <Stack spacing={3}>
        <Typography variant="h6" align="center">
          Editar actividad
        </Typography>

        <Paper elevation={1} sx={{ p: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Nombre de la actividad"
              fullWidth
              value={activityData.name}
              onChange={(e) => setActivityData(prev => ({
                ...prev,
                name: e.target.value
              }))}
            />

            <TextField
              label="Calorías consumidas"
              type="number"
              fullWidth
              value={activityData.kcal}
              onChange={(e) => setActivityData(prev => ({
                ...prev,
                kcal: e.target.value
              }))}
              inputProps={{
                min: 0,
                step: 1
              }}
            />
          </Stack>
        </Paper>

        {error && (
          <Typography color="error" align="center">
            {error}
          </Typography>
        )}

        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            startIcon={<Check />}
            onClick={handleSave}
            disabled={isSaving || !activityData.name.trim() || !activityData.kcal}
            fullWidth
          >
            {isSaving ? 'Guardando...' : 'Confirmar'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Close />}
            onClick={onCancel}
            disabled={isSaving}
            fullWidth
          >
            Cancelar
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default ActivityEditScreen; 