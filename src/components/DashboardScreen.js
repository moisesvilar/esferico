import { Box, Button, Container, Paper, Typography, IconButton } from '@mui/material';
import { ChevronLeft, ChevronRight, Add } from '@mui/icons-material';
import { useState, useEffect, useCallback } from 'react';
import AddFoodScreen from './AddFoodScreen';
import FoodAnalysisResult from './FoodAnalysisResult';
import DailyTabs from './DailyTabs';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { startOfDay, endOfDay } from 'date-fns';

function DashboardScreen({ userName }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddFoodOpen, setIsAddFoodOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [hasMeals, setHasMeals] = useState(false);
  const [dailyTotals, setDailyTotals] = useState({
    totalKcalIngested: 0,
    totalKcalResting: 0,
    totalKcalActivity: 0,
    totalKcalBalance: 0
  });
  const [editingMeal, setEditingMeal] = useState(null);

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
    
    // Resetear las horas tanto de today como de newDate para comparar solo fechas
    today.setHours(0, 0, 0, 0);
    newDate.setHours(0, 0, 0, 0);

    if (newDate > today) {
      setCurrentDate(new Date(today)); // Si intenta ir al futuro, lo llevamos a hoy
      return;
    }

    setCurrentDate(newDate);
  };

  // Envolvemos calculateRestingKcal en su propio useCallback
  const calculateRestingKcal = useCallback((date, dailyBMR) => {
    if (!dailyBMR) return 0;

    console.log('BMR del usuario:', dailyBMR, 'kcal/día');

    // Comparar fechas (sin tiempo)
    const today = new Date();
    const targetDate = new Date(date);
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);

    // Si es un día pasado, devolver el BMR completo
    if (targetDate < today) {
      console.log('Día pasado - BMR completo:', dailyBMR);
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
    console.log('Fecha y hora actual (Madrid):', madridTime);

    const [, time] = madridTime.split(', ');
    const [hours, minutes] = time.split(':').map(Number);
    const hoursElapsed = hours + (minutes / 60);

    console.log('Horas transcurridas:', hoursElapsed.toFixed(2), 'horas');

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
      
      const mealsQuery = query(
        collection(db, 'plates'),
        where('userId', '==', auth.currentUser.uid),
        where('date', '>=', start),
        where('date', '<=', end)
      );

      const snapshot = await getDocs(mealsQuery);
      const meals = snapshot.docs.map(doc => doc.data());
      
      const totalKcalIngested = meals.reduce((sum, meal) => sum + (meal.total_kcal || 0), 0);
      const totalKcalResting = calculateRestingKcal(currentDate, userData.bmr);
      
      setDailyTotals(prev => ({
        ...prev,
        totalKcalIngested,
        totalKcalResting,
        totalKcalActivity: 0,
        totalKcalBalance: totalKcalIngested - totalKcalResting
      }));
      
      setHasMeals(meals.length > 0);
    } catch (error) {
      console.error('Error checking meals:', error);
    }
  }, [currentDate, userData, calculateRestingKcal]);

  useEffect(() => {
    if (auth.currentUser) {
      fetchDailyMeals();
    }
  }, [fetchDailyMeals]); // Ahora solo depende de fetchDailyMeals

  const handleFoodAdded = useCallback(() => {
    setAnalysisData(null);
    setSelectedImage(null);
    setIsAddFoodOpen(false); // Cerrar el modal
    fetchDailyMeals(); // Recargar datos
  }, [fetchDailyMeals]);

  const handleEditFood = (meal) => {
    setEditingMeal(meal);
  };

  // Si estamos editando una comida, mostramos FoodAnalysisResult
  if (editingMeal) {
    return (
      <FoodAnalysisResult 
        analysisData={editingMeal}
        selectedImage={null} // No necesitamos imagen nueva, usamos la URL existente
        currentDate={currentDate}
        onCancel={() => setEditingMeal(null)}
        onSuccess={() => {
          setEditingMeal(null);
          fetchDailyMeals();
        }}
        isEditing={true}
        imageUrl={editingMeal.imageUrl}
      />
    );
  }

  // Si estamos añadiendo una comida nueva
  if (analysisData && selectedImage) {
    return (
      <FoodAnalysisResult 
        analysisData={analysisData}
        selectedImage={selectedImage}
        currentDate={currentDate}
        onCancel={() => {
          setAnalysisData(null);
          setSelectedImage(null);
        }}
        onSuccess={handleFoodAdded}
        isEditing={false}
      />
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      {/* Fecha y navegación */}
      <Paper elevation={3} sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton onClick={() => navigateDate(-1)}>
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
        <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold' }}>
          {dailyTotals.totalKcalBalance} kcal
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          éste es tu balance calórico total para este día
        </Typography>
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
      {hasMeals ? (
        <DailyTabs 
          currentDate={currentDate}
          onAddFood={() => setIsAddFoodOpen(true)}
          onEditFood={handleEditFood}
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
              onClick={() => console.log(`añadir actividad en el día ${currentDate.toLocaleDateString()}`)}
            >
              Añadir actividad
            </Button>
          </Paper>
        </Box>
      )}

      <AddFoodScreen 
        open={isAddFoodOpen}
        onClose={() => setIsAddFoodOpen(false)}
        onImageAnalyzed={(image, data) => {
          setSelectedImage(image);
          setAnalysisData(data);
          setIsAddFoodOpen(false); // Cerrar el modal al recibir el análisis
        }}
      />
    </Container>
  );
}

export default DashboardScreen; 