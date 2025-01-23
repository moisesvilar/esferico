import { Box, Typography, IconButton, Container, Stack } from '@mui/material';
import { Close, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  format, 
  addWeeks, 
  subWeeks,
  endOfDay,
  startOfDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LabelList } from 'recharts';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

function WeekScreen({ onClose }) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [weekData, setWeekData] = useState([]);
  const [userCreationDate, setUserCreationDate] = useState(null);

  useEffect(() => {
    const fetchWeekData = async () => {
      if (!auth.currentUser) return;

      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
      const now = new Date();
      
      const weekDays = eachDayOfInterval({
        start: weekStart,
        end: weekEnd
      });

      try {
        const platesQuery = query(
          collection(db, 'plates'),
          where('userId', '==', auth.currentUser.uid),
          where('date', '>=', weekStart.toISOString()),
          where('date', '<=', weekEnd.toISOString())
        );

        const activitiesQuery = query(
          collection(db, 'activities'),
          where('userId', '==', auth.currentUser.uid),
          where('date', '>=', weekStart.toISOString()),
          where('date', '<=', weekEnd.toISOString())
        );

        const [platesSnapshot, activitiesSnapshot, userDoc] = await Promise.all([
          getDocs(platesQuery),
          getDocs(activitiesQuery),
          getDoc(doc(db, 'users', auth.currentUser.uid))
        ]);

        const userData = userDoc.exists() ? userDoc.data() : null;
        const bmr = userData?.bmr || 0;

        const dailyData = weekDays.reduce((acc, day) => {
          if (day > now) {
            acc[format(day, 'yyyy-MM-dd')] = {
              date: day,
              kcalIngested: null,
              kcalBurned: null,
              balance: null,
              isFuture: true
            };
            return acc;
          }

          acc[format(day, 'yyyy-MM-dd')] = {
            date: day,
            kcalIngested: 0,
            kcalBurned: 0,
            balance: 0,
            isFuture: false
          };
          return acc;
        }, {});

        platesSnapshot.forEach(doc => {
          const plate = doc.data();
          const plateDate = new Date(plate.date);
          const dateKey = format(plateDate, 'yyyy-MM-dd');
          
          if (dailyData[dateKey] && !dailyData[dateKey].isFuture) {
            dailyData[dateKey].kcalIngested += Number(plate.total_kcal || 0);
          }
        });

        activitiesSnapshot.forEach(doc => {
          const activity = doc.data();
          const activityDate = new Date(activity.date);
          const dateKey = format(activityDate, 'yyyy-MM-dd');
          
          if (dailyData[dateKey] && !dailyData[dateKey].isFuture) {
            dailyData[dateKey].kcalBurned += Number(activity.kcal || 0);
          }
        });

        const finalData = Object.values(dailyData).map(day => {
          const formattedDate = format(day.date, 'd-MMM', { locale: es });
          const isPast = userCreationDate && startOfDay(day.date) < startOfDay(userCreationDate);
          
          if (day.isFuture || isPast) {
            return {
              ...day,
              kcalIngested: 0,
              kcalBurned: 0,
              balance: 0,
              formattedDate,
              isPast
            };
          }

          let dailyBmr = bmr;
          
          if (format(day.date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')) {
            const hoursElapsed = now.getHours() + (now.getMinutes() / 60);
            dailyBmr = (bmr / 24) * hoursElapsed;
          }

          const totalBurned = day.kcalBurned + dailyBmr;
          const dailyBalance = day.kcalIngested - totalBurned;

          return {
            ...day,
            kcalBurned: totalBurned,
            balance: dailyBalance,
            formattedDate,
            isPast
          };
        });

        setWeekData(finalData);
      } catch (error) {
        console.error('Error fetching week data:', error);
      }
    };

    fetchWeekData();
  }, [currentWeek, userCreationDate]);

  useEffect(() => {
    const storedDate = localStorage.getItem('userCreationDate');
    if (storedDate) {
      const createdAt = new Date(storedDate);
      setUserCreationDate(createdAt);
    }
  }, []);

  const navigateWeek = (direction) => {
    setCurrentWeek(current => {
      const newDate = direction === 'next' ? addWeeks(current, 1) : subWeeks(current, 1);
      const now = new Date();

      if (direction === 'next') {
        const currentWeekEnd = endOfWeek(current, { weekStartsOn: 1 });
        const todayEnd = endOfDay(now);
        if (currentWeekEnd >= todayEnd) {
          return current;
        }
      }
      
      if (direction === 'prev' && userCreationDate) {
        const newWeekEnd = endOfWeek(newDate, { weekStartsOn: 1 });
        if (newWeekEnd < userCreationDate) {
          return current;
        }
      }
      
      return newDate;
    });
  };

  const getStatusColor = (balance, isFuture, isPast) => {
    if (isFuture || isPast || balance === null) return '#ccc';
    return balance < 0 ? '#4caf50' : '#ff9800';
  };

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentWeek, { weekStartsOn: 1 }),
    end: endOfWeek(currentWeek, { weekStartsOn: 1 })
  });

  const weeklyBalance = Math.round(
    weekData
      .filter(day => !day.isFuture)
      .reduce((sum, day) => sum + (day.balance || 0), 0)
  );

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'background.default',
        zIndex: 1200,
        overflow: 'auto'
      }}
    >
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        alignItems: 'center',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'white'
      }}>
        <IconButton 
          edge="start" 
          onClick={onClose}
          sx={{ mr: 2 }}
        >
          <Close />
        </IconButton>
        <Typography variant="h6">
          Tu semana
        </Typography>
      </Box>
      
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          mb: 3
        }}>
          <IconButton 
            onClick={() => navigateWeek('prev')}
            disabled={userCreationDate && 
              endOfWeek(subWeeks(currentWeek, 1), { weekStartsOn: 1 }) < userCreationDate}
          >
            <ChevronLeft />
          </IconButton>
          <Typography>
            {format(weekDays[0], 'd MMM', { locale: es })} - {format(weekDays[6], 'd MMM', { locale: es })}
          </Typography>
          <IconButton 
            onClick={() => navigateWeek('next')}
            disabled={endOfWeek(currentWeek, { weekStartsOn: 1 }) >= endOfDay(new Date())}
          >
            <ChevronRight />
          </IconButton>
        </Box>

        <Stack alignItems="center" sx={{ mb: 4 }}>
          <Typography 
            variant="h4" 
            sx={{ 
              color: getStatusColor(weeklyBalance, false, false),
              fontWeight: 'bold'
            }}
          >
            {Math.round(weeklyBalance)} kcal
          </Typography>
          <Typography variant="caption" color="text.secondary">
            este es tu balance total semanal
          </Typography>
        </Stack>

        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          mb: 4,
          px: 2
        }}>
          {weekData.map((day, index) => (
            <Stack key={index} alignItems="center" spacing={1}>
              <Typography variant="body2">
                {format(day.date, 'EEEEEE', { locale: es }).toUpperCase()}
              </Typography>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: getStatusColor(day.balance, day.isFuture, day.isPast)
                }}
              />
            </Stack>
          ))}
        </Box>

        <Box sx={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={weekData} 
              margin={{ top: 20 }}
            >
              <XAxis 
                dataKey="formattedDate" 
                tick={{ fontSize: 10 }}
                interval={0}
              />
              <YAxis 
                hide={true}
                domain={[
                  dataMin => Math.floor(dataMin * 1.3), 
                  dataMax => Math.ceil(dataMax * 1.3)
                ]}
              />
              <Tooltip />
              <Bar
                dataKey="balance"
                fill="#ff9800"
                stroke="none"
              >
                <LabelList 
                  dataKey="balance" 
                  position="top" 
                  style={{ fontSize: '10px' }}
                  formatter={(value) => value && value !== 0 ? Math.round(value) : ''}
                />
                {
                  weekData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getStatusColor(entry.balance, entry.isFuture, entry.isPast)}
                    />
                  ))
                }
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Container>
    </Box>
  );
}

export default WeekScreen; 