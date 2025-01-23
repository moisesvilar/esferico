import { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  IconButton, 
  Typography, 
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Close, Star, ChevronRight, Search } from '@mui/icons-material';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import FoodAnalysisResult from './FoodAnalysisResult';

function FavoriteFoodsScreen({ onClose }) {
  const [favorites, setFavorites] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, food: null });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchFavorites();
  }, []);

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
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const handleUnfavorite = async (food) => {
    try {
      await updateDoc(doc(db, 'plates', food.id), {
        isFavorite: false
      });
      
      // Actualizar el estado local
      setFavorites(prev => prev.filter(f => f.id !== food.id));
      setConfirmDialog({ open: false, food: null });
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  };

  // Filtrar y ordenar comidas
  const filteredFavorites = useMemo(() => {
    return favorites
      .filter(food => 
        food.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.description.localeCompare(b.description));
  }, [favorites, searchTerm]);

  return (
    <Box sx={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      bgcolor: 'background.default',
      zIndex: 1200
    }}>
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        alignItems: 'center',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'white'
      }}>
        <IconButton edge="start" onClick={onClose} sx={{ mr: 2 }}>
          <Close />
        </IconButton>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Comidas favoritas
        </Typography>
      </Box>

      {/* Buscador */}
      <Box sx={{ p: 2, bgcolor: 'white' }}>
        <TextField
          fullWidth
          placeholder="Buscar en favoritos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          size="small"
        />
      </Box>

      {/* Lista de favoritos */}
      <List sx={{ pt: 0 }}>
        {filteredFavorites.map((food) => (
          <ListItem
            key={food.id}
            secondaryAction={
              <Stack direction="row" spacing={1} alignItems="center">
                <IconButton 
                  edge="end" 
                  onClick={() => setConfirmDialog({ open: true, food })}
                  color="warning"
                >
                  <Star />
                </IconButton>
                <IconButton 
                  edge="end" 
                  onClick={() => setSelectedFood(food)}
                >
                  <ChevronRight />
                </IconButton>
              </Stack>
            }
          >
            <ListItemAvatar>
              <Avatar 
                src={food.imageUrl} 
                variant="rounded"
                sx={{ width: 56, height: 56, mr: 2 }}
              />
            </ListItemAvatar>
            <ListItemText
              primary={food.description}
              secondary={
                <Typography variant="body2" color="text.secondary">
                  {food.total_weight}g · {food.total_kcal} kcal
                </Typography>
              }
            />
          </ListItem>
        ))}
        
        {filteredFavorites.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {searchTerm 
                ? 'No se encontraron comidas que coincidan con tu búsqueda'
                : 'No tienes comidas favoritas guardadas'}
            </Typography>
          </Box>
        )}
      </List>

      {/* Diálogo de detalle */}
      {selectedFood && (
        <Dialog 
          open={true} 
          onClose={() => setSelectedFood(null)}
          fullWidth
          maxWidth="md"
        >
          <FoodAnalysisResult
            analysisData={selectedFood}
            onCancel={() => setSelectedFood(null)}
            onSuccess={() => {
              setSelectedFood(null);
              fetchFavorites();
            }}
            isEditing={true}
            imageUrl={selectedFood.imageUrl}
            readOnly={true}
            currentDate={new Date()}
            userCreationDate={selectedFood.createdAt?.toDate?.() || new Date()}
          />
        </Dialog>
      )}

      {/* Diálogo de confirmación */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, food: null })}
      >
        <DialogTitle>
          Quitar de favoritos
        </DialogTitle>
        <DialogContent>
          <Typography>
            ¿Quieres quitar esta comida de tus favoritos?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setConfirmDialog({ open: false, food: null })}
          >
            Cancelar
          </Button>
          <Button 
            onClick={() => handleUnfavorite(confirmDialog.food)}
            color="warning"
            variant="contained"
          >
            Quitar de favoritos
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default FavoriteFoodsScreen; 