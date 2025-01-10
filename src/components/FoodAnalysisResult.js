import { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  TextField,
  Stack,
  Paper
} from '@mui/material';
import { Edit, Add, Check, Close } from '@mui/icons-material';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, storage, db } from '../config/firebase';

function FoodAnalysisResult({ analysisData, selectedImage, currentDate, onCancel, onSuccess }) {
  const [imageUrl, setImageUrl] = useState('');
  const [plateData, setPlateData] = useState(analysisData);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageUrl(e.target.result);
    };
    reader.readAsDataURL(selectedImage);
  }, [selectedImage]);

  const handleEditIngredient = (name) => {
    console.log(`editar manualmente para el ingrediente ${name}`);
  };

  const handleAddIngredient = () => {
    console.log('añadir ingrediente');
  };

  const handleIngredientChange = (index, field, value) => {
    setPlateData(prev => {
      const newData = { ...prev };
      newData.components[index][field] = Number(value);
      
      // Recalculamos totales
      newData.total_weight = newData.components.reduce((sum, ing) => sum + ing.weight, 0);
      newData.total_kcal = newData.components.reduce((sum, ing) => sum + ing.kcal, 0);
      // ... otros totales si es necesario
      
      return newData;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // 1. Subir imagen a Firebase Storage
      const storageRef = ref(storage, `plates/${auth.currentUser.uid}/${Date.now()}.jpg`);
      const imageSnapshot = await uploadBytes(storageRef, selectedImage);
      const imageDownloadUrl = await getDownloadURL(imageSnapshot.ref);

      // 2. Guardar datos en Firestore
      const plateDoc = {
        date: currentDate.toISOString(),
        description: plateData.description || '',
        total_kcal: Number(plateData.total_kcal) || 0,
        total_weight: Number(plateData.total_weight) || 0,
        total_protein_weight: Number(plateData.total_protein_weight) || 0,
        total_carbohydrates_weight: Number(plateData.total_carbohydrates_weight) || 0,
        total_fats_weight: Number(plateData.total_fats_weight) || 0,
        components: plateData.components.map(component => ({
          name: component.name || '',
          weight: Number(component.weight) || 0,
          kcal: Number(component.kcal) || 0,
          protein_weight: Number(component.protein_weight) || 0,
          carbohydrates_weight: Number(component.carbohydrates_weight) || 0,
          fats_weight: Number(component.fats_weight) || 0
        })),
        imageUrl: imageDownloadUrl,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'plates'), plateDoc);
      onSuccess();
    } catch (error) {
      console.error('Error saving plate:', error);
      setError('Error al guardar los datos');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Imagen */}
        <Box 
          sx={{ 
            width: '100%',
            height: '100px',
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            margin: 0,
            padding: 0,
            borderRadius: 1,
            boxShadow: 1
          }}
        />

        {/* Descripción del plato */}
        <Typography variant="body1" align="center">
          {analysisData.description}
        </Typography>

        {/* Lista de ingredientes */}
        <Stack spacing={2}>
          {plateData.components.map((ingredient, index) => (
            <Paper key={index} elevation={1} sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography>{ingredient.name}</Typography>
                
                <Stack direction="row" spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      label="Peso (g)"
                      type="number"
                      value={ingredient.weight}
                      onChange={(e) => handleIngredientChange(index, 'weight', e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      label="Kcal"
                      type="number"
                      value={ingredient.kcal}
                      onChange={(e) => handleIngredientChange(index, 'kcal', e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Box>
                </Stack>

                <Button
                  variant="outlined"
                  startIcon={<Edit />}
                  onClick={() => handleEditIngredient(ingredient.name)}
                  fullWidth
                >
                  Editar manualmente
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>

        {/* Botón añadir ingrediente */}
        <Button
          variant="outlined"
          startIcon={<Add />}
          onClick={handleAddIngredient}
          fullWidth
        >
          Añadir ingrediente
        </Button>

        {/* Totales */}
        <Paper elevation={1} sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={2} justifyContent="space-evenly">
              <Stack alignItems="center">
                <Typography>{analysisData.total_weight}g</Typography>
                <Typography variant="caption">peso total</Typography>
              </Stack>
              <Stack alignItems="center">
                <Typography>{analysisData.total_kcal} kcal</Typography>
                <Typography variant="caption">calorías totales</Typography>
              </Stack>
            </Stack>
            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Stack alignItems="center">
                <Typography variant="caption">{analysisData.total_protein_weight}g</Typography>
                <Typography variant="caption">proteínas</Typography>
              </Stack>
              <Stack alignItems="center">
                <Typography variant="caption">{analysisData.total_carbohydrates_weight}g</Typography>
                <Typography variant="caption">carbohidratos</Typography>
              </Stack>
              <Stack alignItems="center">
                <Typography variant="caption">{analysisData.total_fats_weight}g</Typography>
                <Typography variant="caption">grasas</Typography>
              </Stack>
            </Stack>
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
            disabled={isSaving}
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

export default FoodAnalysisResult; 