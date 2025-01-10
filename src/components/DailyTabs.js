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
  Avatar
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { collection, query, where, getDocs } from 'firebase/firestore';
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

  return (
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
          <List sx={{ width: '100%' }}>
            {meals.map((meal) => (
              <ListItem key={meal.id}>
                <ListItemAvatar>
                  <Avatar 
                    variant="rounded"
                    src={meal.imageUrl}
                    alt={meal.description}
                  />
                </ListItemAvatar>
                <ListItemText
                  primary={meal.description}
                  secondary={
                    <Typography variant="body2" color="text.secondary">
                      {meal.total_weight}g · {meal.total_kcal} kcal
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
          <Button
            fullWidth
            variant="contained"
            startIcon={<Add />}
            onClick={onAddFood}
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
  );
}

export default DailyTabs; 