import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  TextField,
  Stack,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  styled
} from '@mui/material';
import { Edit, Add, Check, Close, Delete, ZoomIn } from '@mui/icons-material';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { auth, storage, db } from '../config/firebase';

// Añadir esta función de utilidad fuera del componente
const fetchWithRetry = async (url, options, maxRetries = 5, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      
      console.log(`Intento ${attempt} fallido. Estado: ${response.status}`);
      
      if (attempt === maxRetries) {
        throw new Error(`Error en la llamada al servidor después de ${maxRetries} intentos: ${response.status} ${response.statusText}`);
      }
      
      // Esperar antes del siguiente intento (delay exponencial)
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
      
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`Error en el intento ${attempt}:`, error);
      // Esperar antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
};

// Añadir styled component para la imagen ampliada
const FullScreenImage = styled('img')({
  maxWidth: '100%',
  maxHeight: '90vh',
  objectFit: 'contain'
});

const FoodAnalysisResult = React.memo(({ 
  analysisData, 
  selectedImage, 
  currentDate, 
  onCancel, 
  onSuccess,
  isEditing = false,
  imageUrl = null 
}) => {
  const [plateData, setPlateData] = useState(analysisData);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(imageUrl);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editingIngredientIndex, setEditingIngredientIndex] = useState(null);
  const [manualEditText, setManualEditText] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newIngredientText, setNewIngredientText] = useState('');
  const currentEditingIndex = useRef(null);
  const [dialogMode, setDialogMode] = useState(null);
  const [isEditProcessing, setIsEditProcessing] = useState(false);
  const [isAddProcessing, setIsAddProcessing] = useState(false);
  const [originalValues] = useState(() => 
    analysisData.components.map(component => ({
      weight: component.weight,
      kcal: component.kcal,
      protein_weight: component.protein_weight,
      carbohydrates_weight: component.carbohydrates_weight,
      fats_weight: component.fats_weight
    }))
  );
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);

  useEffect(() => {
    if (selectedImage && !imageUrl) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target.result);
      };
      reader.readAsDataURL(selectedImage);
    }
  }, [selectedImage, imageUrl]);

  const handleEditIngredient = useCallback((index) => {
    setDialogMode('edit');
    setIsAddDialogOpen(true);
    setEditingIngredientIndex(index);
    currentEditingIndex.current = index;
    setManualEditText('');
  }, []);

  const handleManualEditClose = useCallback(() => {
    setIsAddDialogOpen(false);
    setManualEditText('');
  }, []);

  const handleManualEditSave = useCallback(async () => {
    if (currentEditingIndex.current !== null && manualEditText.trim()) {
      setIsEditProcessing(true);
      setError(null);
      
      try {
        const requestData = {
          plate: {
            description: plateData.description,
            total_kcal: plateData.total_kcal,
            total_weight: plateData.total_weight,
            total_protein_weight: plateData.total_protein_weight,
            total_carbohydrates_weight: plateData.total_carbohydrates_weight,
            total_fats_weight: plateData.total_fats_weight,
            components: plateData.components.map(component => ({
              name: component.name,
              kcal: component.kcal,
              weight: component.weight,
              protein_weight: component.protein_weight,
              carbohydrates_weight: component.carbohydrates_weight,
              fats_weight: component.fats_weight
            }))
          },
          instructions: manualEditText.trim(),
          index: currentEditingIndex.current,
          name: plateData.components[currentEditingIndex.current].name
        };

        const response = await fetchWithRetry(
          'https://hook.eu2.make.com/rgkn94t4p7tw3c5f153fu710jslz1trh',
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

        const currentIndex = currentEditingIndex.current;

        const parsedResponse = JSON.parse(cleanJson);

        setPlateData(prev => {
          const newData = { ...prev };
          
          if (currentIndex === null || currentIndex >= newData.components.length) {
            console.error('Índice no válido o componente no encontrado:', currentIndex);
            return prev;
          }

          const component = newData.components[currentIndex];
          if (!component) {
            console.error('Componente no encontrado para el índice:', currentIndex);
            return prev;
          }

          try {
            component.name = parsedResponse.name || component.name;
            component.kcal = parsedResponse.kcal || component.kcal;
            component.weight = parsedResponse.weight || component.weight;
            component.protein_weight = parsedResponse.protein_weight || component.protein_weight;
            component.carbohydrates_weight = parsedResponse.carbohydrates_weight || component.carbohydrates_weight;
            component.fats_weight = parsedResponse.fats_weight || component.fats_weight;

            newData.total_weight = newData.components.reduce((sum, ing) => sum + (ing.weight || 0), 0);
            newData.total_kcal = newData.components.reduce((sum, ing) => sum + (ing.kcal || 0), 0);
            newData.total_protein_weight = newData.components.reduce((sum, ing) => sum + (ing.protein_weight || 0), 0);
            newData.total_carbohydrates_weight = newData.components.reduce((sum, ing) => sum + (ing.carbohydrates_weight || 0), 0);
            newData.total_fats_weight = newData.components.reduce((sum, ing) => sum + (ing.fats_weight || 0), 0);

            return newData;
          } catch (error) {
            console.error('Error al actualizar el componente:', error);
            return prev;
          }
        });

        setIsAddDialogOpen(false);
        setEditingIngredientIndex(null);
        currentEditingIndex.current = null;
        setManualEditText('');
        
      } catch (error) {
        console.error('Error al procesar la edición manual:', error);
        setError(`Error al procesar la edición manual: ${error.message}`);
      } finally {
        setIsEditProcessing(false);
      }
    }
  }, [manualEditText, plateData]);

  const handleAddDialogClose = () => {
    setIsAddDialogOpen(false);
    setNewIngredientText('');
  };

  const handleAddDialogSave = useCallback(async () => {
    if (newIngredientText.trim()) {
      setIsAddProcessing(true);
      setError(null);

      try {
        const requestData = {
          instructions: newIngredientText.trim()
        };

        const response = await fetchWithRetry(
          'https://hook.eu2.make.com/nssygapxbcco9w5ij35p820ufjimmrgx',
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

        setPlateData(prev => {
          const newData = { ...prev };
          
          newData.components.push({
            name: parsedResponse.name,
            kcal: parsedResponse.kcal,
            weight: parsedResponse.weight,
            protein_weight: parsedResponse.protein_weight,
            carbohydrates_weight: parsedResponse.carbohydrates_weight,
            fats_weight: parsedResponse.fats_weight
          });

          const len = newData.components.length;
          if (len >= 2) {
            const last = newData.components[len - 1];
            const prevLast = newData.components[len - 2];
            
            if (last.name === prevLast.name &&
                last.kcal === prevLast.kcal &&
                last.weight === prevLast.weight &&
                last.protein_weight === prevLast.protein_weight &&
                last.carbohydrates_weight === prevLast.carbohydrates_weight &&
                last.fats_weight === prevLast.fats_weight) {
              newData.components.pop();
            }
          }

          newData.total_weight = newData.components.reduce((sum, ing) => sum + (ing.weight || 0), 0);
          newData.total_kcal = newData.components.reduce((sum, ing) => sum + (ing.kcal || 0), 0);
          newData.total_protein_weight = newData.components.reduce((sum, ing) => sum + (ing.protein_weight || 0), 0);
          newData.total_carbohydrates_weight = newData.components.reduce((sum, ing) => sum + (ing.carbohydrates_weight || 0), 0);
          newData.total_fats_weight = newData.components.reduce((sum, ing) => sum + (ing.fats_weight || 0), 0);

          return newData;
        });

        handleAddDialogClose();
      } catch (error) {
        console.error('Error al procesar el nuevo ingrediente:', error);
        setError(`Error al procesar el nuevo ingrediente: ${error.message}`);
      } finally {
        setIsAddProcessing(false);
      }
    }
  }, [newIngredientText]);

  const handleAddIngredient = () => {
    setDialogMode('add');
    setIsAddDialogOpen(true);
    setNewIngredientText('');
  };

  const handleIngredientChange = (index, field, value) => {
    setPlateData(prev => {
      const newData = { ...prev };
      newData.components[index][field] = value === '' ? '' : Number(value);

      // Recalcular totales después de cada cambio
      newData.total_weight = newData.components.reduce((sum, ing) => sum + (ing.weight || 0), 0);
      newData.total_kcal = newData.components.reduce((sum, ing) => sum + (ing.kcal || 0), 0);
      newData.total_protein_weight = newData.components.reduce((sum, ing) => sum + (ing.protein_weight || 0), 0);
      newData.total_carbohydrates_weight = newData.components.reduce((sum, ing) => sum + (ing.carbohydrates_weight || 0), 0);
      newData.total_fats_weight = newData.components.reduce((sum, ing) => sum + (ing.fats_weight || 0), 0);

      return newData;
    });
  };

  const handleWeightBlur = (index) => {
    setPlateData(prev => {
      const newData = { ...prev };
      const ingredient = newData.components[index];
      const originalIngredient = originalValues[index];
      
      const ratio = ingredient.weight / originalIngredient.weight;
      ingredient.kcal = Math.round(originalIngredient.kcal * ratio);
      ingredient.protein_weight = Math.round(originalIngredient.protein_weight * ratio);
      ingredient.carbohydrates_weight = Math.round(originalIngredient.carbohydrates_weight * ratio);
      ingredient.fats_weight = Math.round(originalIngredient.fats_weight * ratio);
      
      newData.total_weight = newData.components.reduce((sum, ing) => sum + (ing.weight || 0), 0);
      newData.total_kcal = newData.components.reduce((sum, ing) => sum + (ing.kcal || 0), 0);
      newData.total_protein_weight = newData.components.reduce((sum, ing) => sum + (ing.protein_weight || 0), 0);
      newData.total_carbohydrates_weight = newData.components.reduce((sum, ing) => sum + (ing.carbohydrates_weight || 0), 0);
      newData.total_fats_weight = newData.components.reduce((sum, ing) => sum + (ing.fats_weight || 0), 0);
      
      return newData;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      let finalImageUrl = imageUrl;

      if (selectedImage) {
        const storageRef = ref(storage, `plates/${auth.currentUser.uid}/${Date.now()}.jpg`);
        const imageSnapshot = await uploadBytes(storageRef, selectedImage);
        finalImageUrl = await getDownloadURL(imageSnapshot.ref);
      } else {
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

  const handleImageClick = (event) => {
    if (isEditing) {
      setMenuAnchorEl(event.currentTarget);
    }
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleChangeImage = () => {
    handleMenuClose();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      if (e.target.files && e.target.files[0]) {
        const newImage = e.target.files[0];
        
        try {
          const reader = new FileReader();
          reader.onload = (e) => {
            setPreviewUrl(e.target.result);
          };
          reader.readAsDataURL(newImage);

          const storageRef = ref(storage, `plates/${auth.currentUser.uid}/${Date.now()}.jpg`);
          const imageSnapshot = await uploadBytes(storageRef, newImage);
          const newImageUrl = await getDownloadURL(imageSnapshot.ref);

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
  };

  const handleExpandImage = () => {
    handleMenuClose();
    setIsImageDialogOpen(true);
  };

  const handleDeleteIngredient = (index) => {
    if (!isEditing) return;

    setPlateData(prev => {
      const newData = { ...prev };
      newData.components = newData.components.filter((_, i) => i !== index);
      
      newData.total_weight = newData.components.reduce((sum, ing) => sum + (ing.weight || 0), 0);
      newData.total_kcal = newData.components.reduce((sum, ing) => sum + (ing.kcal || 0), 0);
      newData.total_protein_weight = newData.components.reduce((sum, ing) => sum + (ing.protein_weight || 0), 0);
      newData.total_carbohydrates_weight = newData.components.reduce((sum, ing) => sum + (ing.carbohydrates_weight || 0), 0);
      newData.total_fats_weight = newData.components.reduce((sum, ing) => sum + (ing.fats_weight || 0), 0);
      
      return newData;
    });
  };

  return (
    <>
      <Box sx={{ width: '100%' }}>
        <Stack spacing={3}>
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
                  content: '"Opciones de imagen"',
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

          <Stack spacing={2}>
            {plateData.components.map((ingredient, index) => (
              <Paper key={index} elevation={1} sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
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
                    
                    {isEditing && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteIngredient(index);
                        }}
                        sx={{ ml: 1 }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Box>

                  <Stack direction="row" spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <TextField
                        label="Peso (g)"
                        type="number"
                        value={ingredient.weight === 0 ? '' : ingredient.weight}
                        onChange={(e) => handleIngredientChange(index, 'weight', e.target.value)}
                        onBlur={() => {
                          if (ingredient.weight === '') {
                            handleIngredientChange(index, 'weight', '0');
                          }
                          handleWeightBlur(index);
                        }}
                        fullWidth
                        size="small"
                        inputProps={{
                          min: 0,
                          step: "1"
                        }}
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <TextField
                        label="Kcal"
                        type="number"
                        value={ingredient.kcal === 0 ? '' : ingredient.kcal}
                        onChange={(e) => handleIngredientChange(index, 'kcal', e.target.value)}
                        fullWidth
                        size="small"
                        inputProps={{
                          min: 0,
                          step: "1"
                        }}
                      />
                    </Box>
                  </Stack>

                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => handleEditIngredient(index)}
                    fullWidth
                  >
                    Editar manualmente
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>

          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={handleAddIngredient}
            fullWidth
          >
            Añadir ingrediente
          </Button>

          <Paper elevation={1} sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={2} justifyContent="space-evenly">
                <Stack alignItems="center">
                  <Typography>{plateData.total_weight}g</Typography>
                  <Typography variant="caption">peso total</Typography>
                </Stack>
                <Stack alignItems="center">
                  <Typography>{plateData.total_kcal} kcal</Typography>
                  <Typography variant="caption">calorías totales</Typography>
                </Stack>
              </Stack>
              <Stack direction="row" spacing={2} justifyContent="space-between">
                <Stack alignItems="center">
                  <Typography variant="caption">{plateData.total_protein_weight}g</Typography>
                  <Typography variant="caption">proteínas</Typography>
                </Stack>
                <Stack alignItems="center">
                  <Typography variant="caption">{plateData.total_carbohydrates_weight}g</Typography>
                  <Typography variant="caption">carbohidratos</Typography>
                </Stack>
                <Stack alignItems="center">
                  <Typography variant="caption">{plateData.total_fats_weight}g</Typography>
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

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleChangeImage}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Cambiar imagen
        </MenuItem>
        <MenuItem onClick={handleExpandImage}>
          <ZoomIn fontSize="small" sx={{ mr: 1 }} />
          Ampliar imagen
        </MenuItem>
      </Menu>

      <Dialog
        open={isAddDialogOpen}
        onClose={dialogMode === 'edit' ? handleManualEditClose : handleAddDialogClose}
        fullWidth
        maxWidth="sm"
        disableEscapeKeyDown
        keepMounted
        aria-labelledby="dialog-title"
      >
        <DialogTitle 
          id="dialog-title" 
          sx={{ typography: 'subtitle1', fontWeight: 'bold' }}
        >
          {dialogMode === 'edit' ? 'Edición manual de ingrediente' : 'Añadir ingrediente'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2">
              {dialogMode === 'edit' 
                ? 'Utiliza el cuadro de texto para editar manual el ingrediente. Puedes indicar, de manera natural, lo que quieres cambiar. Por ejemplo, prueba a escribir cosas como éstas:'
                : 'Utiliza el cuadro de texto para añadir manualmente un ingrediente. Por ejemplo:'
              }
            </Typography>
            <Box 
              component="ul" 
              sx={{ 
                pl: 2, 
                mt: 1,
                typography: 'body2'
              }}
            >
              {dialogMode === 'edit' ? (
                <>
                  <li>"No es pollo, es atún"</li>
                  <li>"El envase dice que tiene 40 kcal cada 100 g"</li>
                  <li>"Estima el peso de un vaso"</li>
                </>
              ) : (
                <>
                  <li>"Lleva un poco de atún"</li>
                  <li>"También lleva un aliño de aceite, vinagre y sal"</li>
                  <li>"Tiene dos cucharadas de harina"</li>
                </>
              )}
            </Box>
            <TextField
              autoFocus
              margin="dense"
              label={dialogMode === 'edit' ? "Introduce aquí tus instrucciones" : "Describe tu ingrediente"}
              placeholder={dialogMode === 'edit' ? undefined : "Describe tu ingrediente"}
              fullWidth
              multiline
              rows={4}
              value={dialogMode === 'edit' ? manualEditText : newIngredientText}
              onChange={(e) => dialogMode === 'edit' 
                ? setManualEditText(e.target.value)
                : setNewIngredientText(e.target.value)
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={dialogMode === 'edit' ? handleManualEditClose : handleAddDialogClose}
          >
            Cancelar
          </Button>
          <Button 
            onClick={dialogMode === 'edit' ? handleManualEditSave : handleAddDialogSave}
            variant="contained"
            disabled={dialogMode === 'edit' 
              ? (!manualEditText.trim() || isEditProcessing)
              : (!newIngredientText.trim() || isAddProcessing)
            }
          >
            {dialogMode === 'edit'
              ? (isEditProcessing ? 'Procesando...' : 'Aceptar')
              : (isAddProcessing ? 'Procesando...' : 'Aceptar')
            }
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isImageDialogOpen}
        onClose={() => setIsImageDialogOpen(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          {plateData.description}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <FullScreenImage src={previewUrl} alt={plateData.description} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsImageDialogOpen(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

FoodAnalysisResult.displayName = 'FoodAnalysisResult';

export default FoodAnalysisResult; 