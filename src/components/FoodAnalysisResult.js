import React, { useState, useCallback, useRef } from 'react';
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
  MenuItem
} from '@mui/material';
import { Edit, Add, Check, Close, Delete, Star, StarBorder } from '@mui/icons-material';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { auth, storage, db } from '../config/firebase';
import SparkMD5 from 'spark-md5';

// Añadir esta función de utilidad fuera del componente
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

// Modificar la función resizeImage para generar dos versiones
const resizeImage = (file, maxWidth = 1024) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calcular nueva altura manteniendo proporción
      const scaleFactor = maxWidth / img.width;
      const newHeight = img.height * scaleFactor;
      
      canvas.width = maxWidth;
      canvas.height = newHeight;
      
      // Dibujar imagen redimensionada
      ctx.drawImage(img, 0, 0, maxWidth, newHeight);
      
      // Convertir a Blob
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.9);  // Usar JPEG con 90% de calidad
      
      // Liberar memoria
      URL.revokeObjectURL(img.src);
    };
  });
};

// Función para calcular MD5 de una imagen
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

// Función auxiliar para formatear fecha
const formatDateToISO = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const FoodAnalysisResult = React.memo(({ 
  analysisData, 
  selectedImage, 
  currentDate, 
  onCancel, 
  onSuccess,
  isEditing = false,
  imageUrl = null,
  userCreationDate,
  isManualInput = false
}) => {
  const [plateData, setPlateData] = useState(() => {
    if (!isEditing) {
      return {
        ...analysisData,
        components: analysisData.components.filter(component => 
          component.name && 
          component.name.trim() !== '' && 
          component.weight > 0
        )
      };
    }
    return analysisData;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isEditingDescription, setIsEditingDescription] = useState(!isEditing);
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
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const dialogTextFieldRef = useRef(null);
  const [isFavorite, setIsFavorite] = useState(analysisData.isFavorite || false);
  const [selectedDate, setSelectedDate] = useState(() => {
    try {
      if (isEditing && analysisData.date) {
        const editDate = new Date(analysisData.date);
        return formatDateToISO(editDate);
      } else {
        const date = new Date();
        if (currentDate instanceof Date && !isNaN(currentDate)) {
          date.setTime(currentDate.getTime());
        }
        return formatDateToISO(date);
      }
    } catch (error) {
      return formatDateToISO(new Date());
    }
  });
  const [dateError, setDateError] = useState(null);
  const [imageMenuAnchorEl, setImageMenuAnchorEl] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);  // Para mostrar la imagen seleccionada
  const [pendingImage, setPendingImage] = useState(null);  // Para guardar el archivo seleccionado

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

  const handleFavoriteToggle = async () => {
    try {
      const newFavoriteState = !isFavorite;
      setIsFavorite(newFavoriteState);

      if (isEditing) {
        await setDoc(doc(db, 'plates', analysisData.id), {
          isFavorite: newFavoriteState
        }, { merge: true });
      }

      setPlateData(prev => ({
        ...prev,
        isFavorite: newFavoriteState
      }));
    } catch (error) {
      console.error('Error updating favorite status:', error);
      setIsFavorite(!isFavorite);
    }
  };

  const validateDate = (dateString) => {
    if (!dateString) return 'La fecha es obligatoria';
    
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day, 0, 0, 0, 0);
      
      // Validar que la fecha es válida
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Si no tenemos fecha de creación, usar una fecha por defecto
      const creationDate = userCreationDate ? new Date(userCreationDate) : new Date(2024, 0, 1);
      creationDate.setHours(0, 0, 0, 0);
      
      if (date < creationDate) {
        return 'La fecha no puede ser anterior a la creación de tu cuenta';
      }
      
      if (date > today) {
        return 'La fecha no puede ser posterior a hoy';
      }
      
      return null;
    } catch (error) {
      console.error('Error validando fecha:', error);
      return 'Fecha inválida';
    }
  };

  const handleSave = async () => {
    const dateValidationError = validateDate(selectedDate);
    if (dateValidationError) {
      setDateError(dateValidationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let finalImageUrl = null;
      let thumbnailUrl = null;
      let imageHash = null;
      let hasImage = false;

      // Si hay una imagen pendiente de subir
      if (pendingImage) {
        hasImage = true;
        imageHash = await calculateImageHash(pendingImage);
        
        // Subir versión grande y pequeña por separado
        const [largeImage, thumbImage] = await Promise.all([
          resizeImage(pendingImage, 1024),
          resizeImage(pendingImage, 100)
        ]);

        // Crear referencias únicas para cada versión
        const timestamp = Date.now();
        const largeStorageRef = ref(storage, `plates/${auth.currentUser.uid}/${timestamp}_large.jpg`);
        const thumbStorageRef = ref(storage, `plates/${auth.currentUser.uid}/${timestamp}_thumb.jpg`);

        // Subir ambas versiones
        const [largeSnapshot, thumbSnapshot] = await Promise.all([
          uploadBytes(largeStorageRef, largeImage),
          uploadBytes(thumbStorageRef, thumbImage)
        ]);

        // Obtener URLs
        [finalImageUrl, thumbnailUrl] = await Promise.all([
          getDownloadURL(largeSnapshot.ref),
          getDownloadURL(thumbSnapshot.ref)
        ]);
      } else if (imageUrl) {
        // Mantener las URLs existentes si hay
        hasImage = true;
        finalImageUrl = imageUrl;
        thumbnailUrl = imageUrl.replace('_large.jpg', '_thumb.jpg');
      }

      // Crear fecha de guardado de forma segura
      let saveDate;
      try {
        if (isEditing) {
          const [year, month, day] = selectedDate.split('-').map(Number);
          saveDate = new Date(year, month - 1, day, 12, 0, 0, 0);
        } else {
          saveDate = new Date(currentDate);
          saveDate.setHours(12, 0, 0, 0);
        }

        const offset = saveDate.getTimezoneOffset();
        saveDate = new Date(saveDate.getTime() - (offset * 60 * 1000));
      } catch (dateError) {
        saveDate = new Date();
        saveDate.setHours(12, 0, 0, 0);
        const offset = saveDate.getTimezoneOffset();
        saveDate = new Date(saveDate.getTime() - (offset * 60 * 1000));
      }

      const plateDoc = {
        date: saveDate.toISOString(),  // Esto guardará la fecha correcta en UTC
        description: plateData.description.trim(),
        total_kcal: Number(plateData.total_kcal) || 0,
        total_weight: Number(plateData.total_weight) || 0,
        total_protein_weight: Number(plateData.total_protein_weight) || 0,
        total_carbohydrates_weight: Number(plateData.total_carbohydrates_weight) || 0,
        total_fats_weight: Number(plateData.total_fats_weight) || 0,
        components: plateData.components.map(component => ({
          name: component.name.trim(),
          weight: Number(component.weight) || 0,
          kcal: Number(component.kcal) || 0,
          protein_weight: Number(component.protein_weight) || 0,
          carbohydrates_weight: Number(component.carbohydrates_weight) || 0,
          fats_weight: Number(component.fats_weight) || 0
        })),
        userId: auth.currentUser.uid,
        isFavorite: isFavorite,
        hasImage,
        imageUrl: finalImageUrl,
        thumbnailUrl: thumbnailUrl,
        imageHash
      };

      if (isEditing) {
        plateDoc.createdAt = analysisData.createdAt;
        await setDoc(doc(db, 'plates', analysisData.id), plateDoc);
      } else {
        plateDoc.createdAt = serverTimestamp();
        await addDoc(collection(db, 'plates'), plateDoc);
      }

      onSuccess();
    } catch (error) {
      setError('Error al guardar los datos. Por favor, inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
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

  const handleChangeImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setPendingImage(file);  // Guardar el archivo para subirlo después
        
        // Crear preview
        const reader = new FileReader();
        reader.onload = (e) => setSelectedImagePreview(e.target.result);
        reader.readAsDataURL(file);
      }
    };
    
    input.click();
  };

  const handleDeleteIngredient = (index) => {
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

  const handleDialogTextFieldFocus = () => {
    setTimeout(() => {
      dialogTextFieldRef.current?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'center'
      });
    }, 100);
  };

  const handleImageClick = (event) => {
    event.preventDefault();
    setImageMenuAnchorEl(event.currentTarget);
  };

  const handleImageMenuClose = () => {
    setImageMenuAnchorEl(null);
  };

  return (
    <>
      <Box sx={{ 
        width: '100%', 
        maxWidth: { xs: '100%', sm: '600px' },  // Ancho máximo más restrictivo
        mx: 'auto',  // Centrar horizontalmente
        p: { xs: 3, sm: 4 },  // Padding general
        boxSizing: 'border-box',  // Incluir padding en el ancho total
        '& > *': {  // Asegurar que los hijos no se desborden
          maxWidth: '100%',
          overflowX: 'hidden'
        }
      }}>
        <Stack spacing={3} sx={{ 
          width: '100%',
          maxWidth: '100%'  // Asegurar que el Stack no se desborde
        }}>
          {!isManualInput && (  // Solo mostrar la imagen si no es entrada manual
            <Box
              sx={{
                width: '100%',
                height: imageUrl ? '100px' : 'auto',
                overflow: 'hidden',
                borderRadius: 1,
                backgroundColor: 'background.paper',
              }}
            >
              {selectedImagePreview || imageUrl ? (
                // Mostrar la imagen seleccionada o la existente
                <Box
                  component="img"
                  src={selectedImagePreview || imageUrl}
                  alt="Imagen del plato"
                  onClick={handleImageClick}
                  sx={{
                    width: '100%',
                    height: '100px',
                    objectFit: 'cover',
                    cursor: 'pointer'
                  }}
                />
              ) : (
                // Botón para añadir imagen
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleChangeImage}
                  sx={{ height: '48px' }}
                >
                  Añadir imagen
                </Button>
              )}
            </Box>
          )}

          <Stack 
            direction="row" 
            alignItems="center" 
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            {isEditingDescription ? (
              <TextField
                value={plateData.description}
                onChange={(e) => setPlateData(prev => ({ ...prev, description: e.target.value }))}
                fullWidth
                size="small"
                sx={{ mr: 1 }}
                placeholder="Nombre del plato"
                autoFocus
              />
            ) : (
              <Typography variant="h6">
                {plateData.description}
              </Typography>
            )}
            
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton 
                onClick={handleFavoriteToggle}
                color={isFavorite ? "warning" : "default"}
              >
                {isFavorite ? <Star /> : <StarBorder />}
              </IconButton>
              <IconButton 
                onClick={() => setIsEditingDescription(!isEditingDescription)}
              >
                {isEditingDescription ? <Check /> : <Edit />}
              </IconButton>
            </Stack>
          </Stack>

          <TextField
            type="date"
            label="Fecha del plato"
            value={selectedDate}
            onChange={(e) => {
              const newDate = e.target.value;
              setSelectedDate(newDate);
              setDateError(validateDate(newDate));
            }}
            error={!!dateError}
            helperText={dateError}
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              min: new Date(userCreationDate).toISOString().split('T')[0],
              max: new Date().toISOString().split('T')[0]
            }}
            fullWidth
            size="small"
            disabled={!isEditing}
          />

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
                          justifyContent: 'space-between',
                          flexGrow: 1
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
                          step: "1",
                          inputMode: "numeric",
                          pattern: "[0-9]*"
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.target.blur();
                          }
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
                          step: "1",
                          inputMode: "numeric",
                          pattern: "[0-9]*"
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.target.blur();
                          }
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
        anchorEl={imageMenuAnchorEl}
        open={Boolean(imageMenuAnchorEl)}
        onClose={handleImageMenuClose}
      >
        <MenuItem 
          onClick={() => {
            handleChangeImage();
            handleImageMenuClose();
          }}
        >
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Cambiar imagen
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
              ref={dialogTextFieldRef}
              onFocus={handleDialogTextFieldFocus}
              sx={{ mb: 2 }}
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
        <DialogContent>
          <Box
            component="img"
            src={imageUrl}
            alt={plateData.description}
            sx={{
              width: '100%',
              height: 'auto',
              maxHeight: '80vh',
              objectFit: 'contain'
            }}
          />
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