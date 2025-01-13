import { useState, useEffect, useCallback, useRef } from 'react';
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
  DialogActions
} from '@mui/material';
import { Edit, Add, Check, Close, Delete } from '@mui/icons-material';
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
  const [manualEditText, setManualEditText] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [originalValues] = useState(() => 
    analysisData.components.map(component => ({
      weight: component.weight,
      kcal: component.kcal,
      protein_weight: component.protein_weight,
      carbohydrates_weight: component.carbohydrates_weight,
      fats_weight: component.fats_weight
    }))
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const currentEditingIndex = useRef(null);

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
    console.log('handleEditIngredient llamado con índice:', index);
    setIsDialogOpen(true);
    setEditingIngredientIndex(index);
    currentEditingIndex.current = index;
    setManualEditText('');
  }, []);

  const handleManualEditClose = useCallback(() => {
    setIsDialogOpen(false);
    setManualEditText('');
  }, []);

  const handleManualEditSave = useCallback(async () => {
    console.log('handleManualEditSave llamado');
    
    if (currentEditingIndex.current !== null && manualEditText.trim()) {
      console.log('Condición válida, editingIngredientIndex:', currentEditingIndex.current, 'texto:', manualEditText);
      setIsProcessing(true);
      setError(null);
      
      try {
        console.log('Iniciando edición manual...');
        
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

        console.log('Datos a enviar:', requestData);

        // Usar fetchWithRetry en lugar de fetch
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

        // Obtener el texto de la respuesta
        const responseText = await response.text();
        console.log('Texto de respuesta:', responseText);

        // Limpiar el texto de la respuesta
        const cleanJson = responseText
          .replace(/^```json\n/, '')  // Eliminar ```json del inicio
          .replace(/\n```$/, '');     // Eliminar ``` del final

        // Capturar el índice actual antes de las actualizaciones
        const currentIndex = currentEditingIndex.current;

        // Parsear el JSON limpio
        const parsedResponse = JSON.parse(cleanJson);
        console.log('JSON parseado:', parsedResponse);

        // Actualizar el estado local con los nuevos valores
        setPlateData(prev => {
          const newData = { ...prev };
          
          // Usar el índice capturado en lugar del ref
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
            // Actualizar valores del componente usando el índice capturado
            component.name = parsedResponse.name || component.name;
            component.kcal = parsedResponse.kcal || component.kcal;
            component.weight = parsedResponse.weight || component.weight;
            component.protein_weight = parsedResponse.protein_weight || component.protein_weight;
            component.carbohydrates_weight = parsedResponse.carbohydrates_weight || component.carbohydrates_weight;
            component.fats_weight = parsedResponse.fats_weight || component.fats_weight;

            // Recalcular totales
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

        // Limpiar estados después de la actualización exitosa
        setIsDialogOpen(false);
        setEditingIngredientIndex(null);
        currentEditingIndex.current = null;
        setManualEditText('');
        
      } catch (error) {
        console.error('Error al procesar la edición manual:', error);
        setError(`Error al procesar la edición manual: ${error.message}`);
      } finally {
        setIsProcessing(false);
      }
    } else {
      console.log('Condición no válida:', { 
        currentEditingIndex: currentEditingIndex.current, 
        manualEditText 
      });
    }
  }, [manualEditText, plateData]);

  const handleAddIngredient = () => {
    setPlateData(prev => ({
      ...prev,
      components: [
        ...prev.components,
        {
          name: 'Nuevo ingrediente',
          weight: 0,
          kcal: 0,
          protein_weight: 0,
          carbohydrates_weight: 0,
          fats_weight: 0
        }
      ]
    }));
  };

  const handleIngredientChange = (index, field, value) => {
    setPlateData(prev => {
      const newData = { ...prev };
      newData.components[index][field] = value === '' ? '' : Number(value);
      return newData;
    });
  };

  const handleWeightBlur = (index) => {
    setPlateData(prev => {
      const newData = { ...prev };
      const ingredient = newData.components[index];
      const originalIngredient = originalValues[index];
      
      // Calcular nuevos valores proporcionalmente
      const ratio = ingredient.weight / originalIngredient.weight;
      ingredient.kcal = Math.round(originalIngredient.kcal * ratio);
      ingredient.protein_weight = Math.round(originalIngredient.protein_weight * ratio);
      ingredient.carbohydrates_weight = Math.round(originalIngredient.carbohydrates_weight * ratio);
      ingredient.fats_weight = Math.round(originalIngredient.fats_weight * ratio);
      
      // Recalcular totales
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

  const handleDeleteIngredient = (index) => {
    if (!isEditing) return;

    setPlateData(prev => {
      const newData = { ...prev };
      newData.components = newData.components.filter((_, i) => i !== index);
      
      // Recalcular totales
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

      <Dialog
        open={isDialogOpen}
        onClose={handleManualEditClose}
        fullWidth
        maxWidth="sm"
        disableEscapeKeyDown
      >
        <DialogTitle sx={{ typography: 'subtitle1', fontWeight: 'bold' }}>
          Edición manual de ingrediente
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2">
              Utiliza el cuadro de texto para editar manual el ingrediente. Puedes indicar, de manera natural, lo que quieres cambiar. Por ejemplo, prueba a escribir cosas como éstas:
            </Typography>
            <Box 
              component="ul" 
              sx={{ 
                pl: 2, 
                mt: 1,
                typography: 'body2'
              }}
            >
              <li>"No es pollo, es atún"</li>
              <li>"El envase dice que tiene 40 kcal cada 100 g"</li>
              <li>"Estima el peso de un vaso"</li>
            </Box>
            <TextField
              autoFocus
              margin="dense"
              label="Introduce aquí tus instrucciones"
              fullWidth
              multiline
              rows={4}
              value={manualEditText}
              onChange={(e) => setManualEditText(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleManualEditClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => {
              console.log('Botón Aceptar pulsado');
              handleManualEditSave();
            }}
            variant="contained"
            disabled={!manualEditText.trim() || isProcessing}
          >
            {isProcessing ? 'Procesando...' : 'Aceptar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default FoodAnalysisResult; 