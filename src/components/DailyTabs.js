import { useState, useEffect } from 'react';
import { 
  Box, 
  Tab, 
  Tabs, 
  Paper, 
  Stack, 
  Button, 
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { startOfDay, endOfDay } from 'date-fns';

function TabPanel({ children, value, index }) {
  return (
    <Box hidden={value !== index} sx={{ pt: 2 }}>
      {value === index && children}
    </Box>
  );
}

function DailyTabs({ currentDate, onAddFood }) {
  const [tabIndex, setTabIndex] = useState(0);
  const [meals, setMeals] = useState([]);
  const [mealToDelete, setMealToDelete] = useState(null);

  useEffect(() => {
    const fetchMeals = async () => {
      if (!auth.currentUser) return;

      try {
        const start = startOfDay(currentDate).toISOString();
        const end = endOfDay(currentDate).toISOString();
        
        const mealsQuery = query(
          collection(db, 'plates'),
          where('userId', '==', auth.currentUser.uid),
          where('date', '>=', start),
          where('date', '<=', end)
        );

        const snapshot = await getDocs(mealsQuery);
        setMeals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error('Error fetching meals:', error);
      }
    };

    if (auth.currentUser) {
      fetchMeals();
    }
  }, [currentDate]);

  const handleAddActivity = () => {
    console.log(`añadir actividad en el día ${currentDate.toLocaleDateString()}`);
  };

  const handleDeleteClick = (meal) => {
    setMealToDelete(meal);
  };

  const handleDeleteConfirm = async () => {
    if (!mealToDelete) return;

    try {
      await deleteDoc(doc(db, 'plates', mealToDelete.id));
      setMeals(meals.filter(meal => meal.id !== mealToDelete.id));
      setMealToDelete(null);
    } catch (error) {
      console.error('Error deleting meal:', error);
    }
  };

  const handleDeleteCancel = () => {
    setMealToDelete(null);
  };

  return (
    <>
      <Paper elevation={3} sx={{ p: 2 }}>
        <Tabs 
          value={tabIndex} 
          onChange={(_, newValue) => setTabIndex(newValue)}
          variant="fullWidth"
        >
          <Tab label="Comidas" />
          <Tab label="Actividad" />
        </Tabs>

        <TabPanel value={tabIndex} index={0}>
          <Stack spacing={2}>
            <List sx={{ width: '100%', p: 0 }}>
              {meals.map((meal) => (
                <ListItem 
                  key={meal.id}
                  sx={{ 
                    py: 2,
                    px: { xs: 1, sm: 2 },
                    '&:not(:last-child)': {
                      borderBottom: '1px solid',
                      borderColor: 'divider'
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar 
                      variant="rounded"
                      src={meal.imageUrl}
                      alt={meal.description}
                      sx={{ 
                        width: 56,
                        height: 56,
                        mr: 2
                      }}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={meal.description}
                    secondary={
                      <Typography variant="body2" color="text.secondary">
                        {meal.total_weight}g · {meal.total_kcal} kcal
                      </Typography>
                    }
                    sx={{ mr: 4 }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton 
                      edge="end" 
                      aria-label="eliminar"
                      onClick={() => handleDeleteClick(meal)}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Add />}
              onClick={onAddFood}
              sx={{ mt: 2 }}
            >
              Añadir comida
            </Button>
          </Stack>
        </TabPanel>

        <TabPanel value={tabIndex} index={1}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<Add />}
            onClick={handleAddActivity}
            sx={{ 
              bgcolor: '#4CAF50',
              '&:hover': {
                bgcolor: '#388E3C'
              }
            }}
          >
            Añadir actividad
          </Button>
        </TabPanel>
      </Paper>

      <Dialog
        open={Boolean(mealToDelete)}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>
          Confirmar eliminación
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que quieres eliminar esta comida?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>
            Cancelar
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            autoFocus
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default DailyTabs; 