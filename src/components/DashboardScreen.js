import { Box, Button, Container, Paper, Typography, IconButton, Stack } from '@mui/material';
import { ChevronLeft, ChevronRight, Add } from '@mui/icons-material';
import { useState, useEffect, useCallback } from 'react';
import AddFoodScreen from './AddFoodScreen';
import FoodAnalysisResult from './FoodAnalysisResult';
import DailyTabs from './DailyTabs';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { startOfDay, endOfDay } from 'date-fns';
import AddActivityScreen from './AddActivityScreen';
import ActivityEditScreen from './ActivityEditScreen';

function DashboardScreen({ userName }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddFoodOpen, setIsAddFoodOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [hasContent, setHasContent] = useState(false);
  const [dailyTotals, setDailyTotals] = useState({
    totalKcalIngested: 0,
    totalKcalResting: 0,
    totalKcalActivity: 0,
    totalKcalBalance: 0
  });
  const [editingMeal, setEditingMeal] = useState(null);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [userCreationDate, setUserCreationDate] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const formatDate = (date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    const dayName = isToday ? 'hoy' : date.toLocaleDateString('es-ES', { weekday: 'long' });
    const restOfDate = date.toLocaleDateString('es-ES', { 
      day: 'numeric',
      month: 'long'
    });

    return `${dayName}, ${restOfDate.replace(' De ', ' de ')}`;
  };

  const navigateDate = (days) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + days);

    // Evitar navegación a días futuros
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    newDate.setHours(0, 0, 0, 0);

    if (newDate > today) {
      setCurrentDate(new Date(today));
      return;
    }

    // Evitar navegación a días anteriores a la creación del usuario
    if (userCreationDate) {
      const creationDate = new Date(userCreationDate);
      creationDate.setHours(0, 0, 0, 0);
      
      if (newDate < creationDate) {
        setCurrentDate(new Date(creationDate));
        return;
      }
    }

    setCurrentDate(newDate);
  };

  // Envolvemos calculateRestingKcal en su propio useCallback
  const calculateRestingKcal = useCallback((date, dailyBMR) => {
    if (!dailyBMR) return 0;

    // Comparar fechas (sin tiempo)
    const today = new Date();
    const targetDate = new Date(date);
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);

    // Si es un día pasado, devolver el BMR completo
    if (targetDate < today) {
      return dailyBMR;
    }

    // Si es el día actual, calcular las kcal según las horas transcurridas
    const madridFormatter = new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const now = new Date();
    const madridTime = madridFormatter.format(now);

    const [, time] = madridTime.split(', ');
    const [hours, minutes] = time.split(':').map(Number);
    const hoursElapsed = hours + (minutes / 60);


    const kcalPerHour = dailyBMR / 24;
    return Math.round(kcalPerHour * hoursElapsed);
  }, []);

  // Efecto para cargar los datos del usuario y calcular el metabolismo
  const [userData, setUserData] = useState(null);
  
  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          
          // Guardar la fecha de creación del usuario
          const creationDate = new Date(auth.currentUser.metadata.creationTime);
          setUserCreationDate(creationDate);
          
          // Guardar en localStorage
          const dateToStore = creationDate.toISOString();
          localStorage.setItem('userCreationDate', dateToStore);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  // Envolvemos fetchDailyMeals en useCallback
  const fetchDailyMeals = useCallback(async () => {
    if (!auth.currentUser || !userData) return;

    try {
      const start = startOfDay(currentDate).toISOString();
      const end = endOfDay(currentDate).toISOString();
      
      // Fetch meals
      const platesQuery = query(
        collection(db, 'plates'),
        where('userId', '==', auth.currentUser.uid),
        where('date', '>=', start),
        where('date', '<=', end)
      );

      // Fetch activities
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('userId', '==', auth.currentUser.uid),
        where('date', '>=', start),
        where('date', '<=', end)
      );

      const [mealsSnapshot, activitiesSnapshot] = await Promise.all([
        getDocs(platesQuery),
        getDocs(activitiesQuery)
      ]);

      // Incluir el ID del documento en los datos
      const meals = mealsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      const activities = activitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      const totalKcalIngested = meals.reduce((sum, meal) => sum + (meal.total_kcal || 0), 0);
      const totalKcalResting = calculateRestingKcal(currentDate, userData.bmr);
      const totalKcalActivity = activities.reduce((sum, activity) => sum + (activity.kcal || 0), 0);
      const totalBalance = totalKcalIngested - totalKcalResting - totalKcalActivity;

      setDailyTotals(prev => ({
        ...prev,
        totalKcalIngested,
        totalKcalResting,
        totalKcalActivity,
        totalKcalBalance: totalBalance
      }));
      
      setHasContent(meals.length > 0 || activities.length > 0);
    } catch (error) {
      console.error('Error checking meals:', error);
    }
  }, [currentDate, userData, calculateRestingKcal]);

  useEffect(() => {
    if (auth.currentUser) {
      fetchDailyMeals();
    }
  }, [fetchDailyMeals]); // Ahora solo depende de fetchDailyMeals

  const handleActivityAdded = useCallback(() => {
    setReloadTrigger(prev => prev + 1);
    setActiveTab(1);
    fetchDailyMeals();
  }, [fetchDailyMeals]);

  const handleFoodAdded = useCallback(() => {
    setIsAddFoodOpen(false);
    setAnalysisData(null);
    setSelectedImage(null);
    setActiveTab(0);
    setReloadTrigger(prev => prev + 1);
    fetchDailyMeals();
  }, [fetchDailyMeals]);

  const handleEditFood = (meal) => {
    setEditingMeal(meal);
  };

  // Añadir manejador para eliminación de actividad
  const handleActivityDeleted = useCallback(() => {
    fetchDailyMeals(); // Esto recalculará todos los totales
  }, [fetchDailyMeals]);

  // Añadir manejador para editar actividad
  const handleEditActivity = (activity) => {
    setEditingActivity(activity);
  };

  // Si estamos editando una comida, mostramos FoodAnalysisResult
  if (editingMeal) {
    return (
      <FoodAnalysisResult 
        analysisData={editingMeal}
        currentDate={currentDate}
        onCancel={() => setEditingMeal(null)}
        onSuccess={() => {
          setEditingMeal(null);
          handleFoodAdded();
        }}
        isEditing={true}
        imageUrl={editingMeal.imageUrl}
        userCreationDate={userCreationDate}
      />
    );
  }

  // Si estamos añadiendo una comida nueva
  if (analysisData) {
    return (
      <FoodAnalysisResult 
        analysisData={analysisData}
        selectedImage={selectedImage}
        currentDate={currentDate}
        onCancel={() => {
          setAnalysisData(null);
          setSelectedImage(null);
        }}
        onSuccess={() => {
          handleFoodAdded();
          setAnalysisData(null);
        }}
        isManualInput={analysisData.isManualInput}
        userCreationDate={userCreationDate}
      />
    );
  }

  // Si estamos editando una actividad
  if (editingActivity) {
    return (
      <ActivityEditScreen 
        activity={editingActivity}
        onCancel={() => setEditingActivity(null)}
        onSuccess={() => {
          setEditingActivity(null);
          handleActivityAdded();
        }}
      />
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      {/* Fecha y navegación */}
      <Paper elevation={3} sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton 
          onClick={() => navigateDate(-1)}
          disabled={
            userCreationDate && 
            new Date(currentDate).setHours(0, 0, 0, 0) === 
            new Date(userCreationDate).setHours(0, 0, 0, 0)
          }
        >
          <ChevronLeft />
        </IconButton>
        <Typography variant="subtitle1">
          {formatDate(currentDate)}
        </Typography>
        <IconButton 
          onClick={() => navigateDate(1)}
          disabled={
            new Date(currentDate).setHours(0, 0, 0, 0) === 
            new Date().setHours(0, 0, 0, 0)
          }
        >
          <ChevronRight />
        </IconButton>
      </Paper>

      {/* Balance calórico principal */}
      <Paper 
        elevation={3} 
        sx={{ 
          p: 3, 
          mb: 3, 
          textAlign: 'center',
          bgcolor: '#f8f8f8'
        }}
      >
        <Stack alignItems="center">
          <Typography 
            variant="h4" 
            sx={{ 
              color: dailyTotals.totalKcalBalance <= 0 ? 'success.main' : 'warning.main',
              fontWeight: 'bold'
            }}
          >
            {dailyTotals.totalKcalBalance} kcal
          </Typography>
          <Typography variant="caption">balance calórico</Typography>
        </Stack>
      </Paper>

      {/* Indicadores secundarios */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
        <Paper elevation={3} sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
            +{dailyTotals.totalKcalIngested} kcal
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            ingeridas
          </Typography>
        </Paper>

        <Paper elevation={3} sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
            -{dailyTotals.totalKcalResting} kcal
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            en reposo
          </Typography>
        </Paper>

        <Paper elevation={3} sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
            -{dailyTotals.totalKcalActivity} kcal
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            en actividad
          </Typography>
        </Paper>
      </Box>

      {/* Botones de acción o pestañas */}
      {hasContent ? (
        <DailyTabs 
          currentDate={currentDate}
          onAddFood={() => setIsAddFoodOpen(true)}
          onEditFood={handleEditFood}
          onAddActivity={() => setIsAddActivityOpen(true)}
          onEditActivity={handleEditActivity}
          reloadTrigger={reloadTrigger}
          onActivityDeleted={handleActivityDeleted}
          defaultTab={activeTab}
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Add />}
              sx={{ mb: 1 }}
              onClick={() => setIsAddFoodOpen(true)}
            >
              Añadir comida
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
              saca una foto de tu plato y nosotros haremos la magia
            </Typography>
          </Paper>

          <Paper elevation={3} sx={{ p: 3 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Add />}
              sx={{ 
                bgcolor: '#4CAF50',
                '&:hover': {
                  bgcolor: '#388E3C'
                }
              }}
              onClick={() => setIsAddActivityOpen(true)}
            >
              Añadir actividad
            </Button>
          </Paper>
        </Box>
      )}

      <AddFoodScreen 
        open={isAddFoodOpen}
        onClose={() => setIsAddFoodOpen(false)}
        currentDate={currentDate}
        onImageAnalyzed={(image, data) => {
          if (image === null && data === null) {
            // Si viene de favoritos, solo refrescar
            handleFoodAdded();
          } else {
            // Si viene de foto o manual, mostrar análisis
            setSelectedImage(image);
            setAnalysisData(data);
            setIsAddFoodOpen(false);
          }
        }}
      />

      <AddActivityScreen 
        open={isAddActivityOpen}
        onClose={() => setIsAddActivityOpen(false)}
        currentDate={currentDate}
        onActivityAdded={handleActivityAdded}
      />
    </Container>
  );
}

export default DashboardScreen; 