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
import { Add, Delete, Star } from '@mui/icons-material';
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

function DailyTabs({ 
  currentDate, 
  onAddFood,
  onEditFood,
  onAddActivity,
  onEditActivity,
  reloadTrigger,
  onActivityDeleted,
  defaultTab = 0
}) {
  const [tabIndex, setTabIndex] = useState(defaultTab);
  const [meals, setMeals] = useState([]);
  const [mealToDelete, setMealToDelete] = useState(null);
  const [activities, setActivities] = useState([]);
  const [activityToDelete, setActivityToDelete] = useState(null);

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

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
        const mealsData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));

        const sortedMeals = mealsData.sort((a, b) => 
          new Date(b.date) - new Date(a.date)
        );

        setMeals(sortedMeals);
      } catch (error) {
        console.error('Error fetching meals:', error);
      }
    };

    if (auth.currentUser) {
      fetchMeals();
    }
  }, [currentDate, reloadTrigger]);

  useEffect(() => {
    const fetchActivities = async () => {
      if (!auth.currentUser) return;

      try {
        const start = startOfDay(currentDate).toISOString();
        const end = endOfDay(currentDate).toISOString();
        
        const activitiesQuery = query(
          collection(db, 'activities'),
          where('userId', '==', auth.currentUser.uid),
          where('date', '>=', start),
          where('date', '<=', end)
        );

        const snapshot = await getDocs(activitiesQuery);
        setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error('Error fetching activities:', error);
      }
    };

    if (auth.currentUser) {
      fetchActivities();
    }
  }, [currentDate, reloadTrigger]);

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

  const handleDeleteActivityClick = (activity) => {
    setActivityToDelete(activity);
  };

  const handleDeleteActivityConfirm = async () => {
    if (!activityToDelete) return;

    try {
      await deleteDoc(doc(db, 'activities', activityToDelete.id));
      setActivities(activities.filter(activity => activity.id !== activityToDelete.id));
      setActivityToDelete(null);
      onActivityDeleted();
    } catch (error) {
      console.error('Error deleting activity:', error);
    }
  };

  const handleDeleteActivityCancel = () => {
    setActivityToDelete(null);
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
          <Tab label="Actividades" />
        </Tabs>

        <TabPanel value={tabIndex} index={0}>
          <Stack spacing={2}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Add />}
              onClick={onAddFood}
            >
              Añadir comida
            </Button>
            
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
                    },
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                  onClick={() => onEditFood(meal)}
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
                    secondaryTypographyProps={{ component: 'div' }}
                    secondary={
                      <Stack spacing={0.5}>
                        <Typography 
                          component="span" 
                          variant="body2" 
                          color="text.secondary"
                        >
                          {meal.total_weight}g · {meal.total_kcal} kcal
                        </Typography>
                        <Typography 
                          component="span" 
                          variant="caption" 
                          color="text.secondary"
                        >
                          {formatTime(meal.date)}
                        </Typography>
                      </Stack>
                    }
                    sx={{ mr: 4 }}
                  />
                  <ListItemSecondaryAction sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {meal.isFavorite && (
                      <Star fontSize="small" color="warning" />
                    )}
                    <IconButton 
                      edge="end" 
                      aria-label="eliminar"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(meal);
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Stack>
        </TabPanel>

        <TabPanel value={tabIndex} index={1}>
          <Stack spacing={2}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Add />}
              onClick={onAddActivity}
              sx={{ 
                bgcolor: '#4CAF50',
                '&:hover': {
                  bgcolor: '#388E3C'
                }
              }}
            >
              Añadir actividad
            </Button>

            <List sx={{ width: '100%', p: 0 }}>
              {activities.map((activity) => (
                <ListItem 
                  key={activity.id}
                  sx={{ 
                    py: 2,
                    px: { xs: 1, sm: 2 },
                    '&:not(:last-child)': {
                      borderBottom: '1px solid',
                      borderColor: 'divider'
                    },
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                  onClick={() => onEditActivity(activity)}
                >
                  <ListItemText
                    primary={activity.name}
                    secondary={
                      <Typography variant="body2" color="text.secondary">
                        {activity.kcal} kcal
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton 
                      edge="end" 
                      aria-label="eliminar"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteActivityClick(activity);
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Stack>
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

      <Dialog
        open={Boolean(activityToDelete)}
        onClose={handleDeleteActivityCancel}
      >
        <DialogTitle>
          Confirmar eliminación
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que quieres eliminar esta actividad?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteActivityCancel}>
            Cancelar
          </Button>
          <Button 
            onClick={handleDeleteActivityConfirm} 
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