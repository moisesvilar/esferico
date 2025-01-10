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
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { auth, storage, db } from '../config/firebase';

function FoodAnalysisResult({ 
  analysisData, 
  selectedImage, 
  currentDate, 
  onCancel, 
  onSuccess,
  isEditing = false,
  imageUrl = null 
}) {
  const [plateData, setPlateData] = useState(analysisData);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(imageUrl);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editingIngredientIndex, setEditingIngredientIndex] = useState(null);

  useEffect(() => {
    if (selectedImage && !imageUrl) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target.result);
      };
      reader.readAsDataURL(selectedImage);
    }
  }, [selectedImage, imageUrl]);

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
      let finalImageUrl = imageUrl;

      // Si hay una imagen nueva (ya sea por edición o nueva comida)
      if (selectedImage) {
        const storageRef = ref(storage, `plates/${auth.currentUser.uid}/${Date.now()}.jpg`);
        const imageSnapshot = await uploadBytes(storageRef, selectedImage);
        finalImageUrl = await getDownloadURL(imageSnapshot.ref);
      } else {
        // Si estamos editando, usamos la URL que ya está en plateData
        finalImageUrl = plateData.imageUrl;
      }

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
        imageUrl: finalImageUrl,
        userId: auth.currentUser.uid,
        updatedAt: serverTimestamp()
      };

      if (isEditing) {
        await setDoc(doc(db, 'plates', plateData.id), plateDoc, { merge: true });
      } else {
        await addDoc(collection(db, 'plates'), {
          ...plateDoc,
          createdAt: serverTimestamp()
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving plate:', error);
      setError('Error al guardar los datos');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDescriptionClick = () => {
    if (isEditing) {
      setIsEditingDescription(true);
    }
  };

  const handleDescriptionChange = (e) => {
    setPlateData(prev => ({
      ...prev,
      description: e.target.value
    }));
  };

  const handleDescriptionBlur = () => {
    setIsEditingDescription(false);
  };

  const handleDescriptionKeyPress = (e) => {
    if (e.key === 'Enter') {
      setIsEditingDescription(false);
    }
  };

  const handleIngredientNameClick = (index) => {
    if (isEditing) {
      setEditingIngredientIndex(index);
    }
  };

  const handleIngredientNameChange = (index, newName) => {
    setPlateData(prev => {
      const newData = { ...prev };
      newData.components[index].name = newName;
      return newData;
    });
  };

  const handleIngredientNameBlur = () => {
    setEditingIngredientIndex(null);
  };

  const handleIngredientNameKeyPress = (e) => {
    if (e.key === 'Enter') {
      setEditingIngredientIndex(null);
    }
  };

  const handleImageClick = () => {
    if (isEditing) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      input.onchange = async (e) => {
        if (e.target.files && e.target.files[0]) {
          const newImage = e.target.files[0];
          
          try {
            // Mostrar preview
            const reader = new FileReader();
            reader.onload = (e) => {
              setPreviewUrl(e.target.result);
            };
            reader.readAsDataURL(newImage);

            // Subir nueva imagen
            const storageRef = ref(storage, `plates/${auth.currentUser.uid}/${Date.now()}.jpg`);
            const imageSnapshot = await uploadBytes(storageRef, newImage);
            const newImageUrl = await getDownloadURL(imageSnapshot.ref);

            // Actualizar URL en plateData
            setPlateData(prev => ({
              ...prev,
              imageUrl: newImageUrl
            }));

          } catch (error) {
            console.error('Error updating image:', error);
            setError('Error al actualizar la imagen');
          }
        }
      };
      
      input.click();
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Imagen */}
        <Box 
          onClick={handleImageClick}
          sx={{ 
            width: '100%',
            height: '100px',
            backgroundImage: `url(${previewUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: 1,
            boxShadow: 1,
            cursor: isEditing ? 'pointer' : 'default',
            position: 'relative',
            '&:hover': isEditing ? {
              '&::after': {
                content: '"Cambiar imagen"',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                borderRadius: 1
              }
            } : {}
          }}
        />

        {/* Descripción del plato */}
        {isEditingDescription ? (
          <TextField
            autoFocus
            fullWidth
            value={plateData.description}
            onChange={handleDescriptionChange}
            onBlur={handleDescriptionBlur}
            onKeyPress={handleDescriptionKeyPress}
            variant="standard"
            sx={{ 
              '& input': { 
                textAlign: 'center',
                fontSize: '1rem',
                fontWeight: 'normal'
              }
            }}
          />
        ) : (
          <Typography 
            variant="body1" 
            align="center"
            onClick={handleDescriptionClick}
            sx={{ 
              cursor: isEditing ? 'pointer' : 'default',
              '&:hover': isEditing ? {
                bgcolor: 'action.hover',
                borderRadius: 1,
                px: 1
              } : {}
            }}
          >
            {plateData.description}
            {isEditing && (
              <Edit 
                fontSize="small" 
                sx={{ 
                  ml: 1, 
                  verticalAlign: 'middle',
                  color: 'text.secondary',
                  fontSize: '0.8rem'
                }} 
              />
            )}
          </Typography>
        )}

        {/* Lista de ingredientes */}
        <Stack spacing={2}>
          {plateData.components.map((ingredient, index) => (
            <Paper key={index} elevation={1} sx={{ p: 2 }}>
              <Stack spacing={2}>
                {editingIngredientIndex === index ? (
                  <TextField
                    autoFocus
                    fullWidth
                    value={ingredient.name}
                    onChange={(e) => handleIngredientNameChange(index, e.target.value)}
                    onBlur={handleIngredientNameBlur}
                    onKeyPress={handleIngredientNameKeyPress}
                    variant="standard"
                    sx={{ 
                      '& input': { 
                        fontSize: '1rem',
                        fontWeight: 'normal'
                      }
                    }}
                  />
                ) : (
                  <Typography 
                    onClick={() => handleIngredientNameClick(index)}
                    sx={{ 
                      cursor: isEditing ? 'pointer' : 'default',
                      '&:hover': isEditing ? {
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        px: 1
                      } : {},
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    {ingredient.name}
                    {isEditing && (
                      <Edit 
                        fontSize="small" 
                        sx={{ 
                          ml: 1,
                          color: 'text.secondary',
                          fontSize: '0.8rem'
                        }} 
                      />
                    )}
                  </Typography>
                )}

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