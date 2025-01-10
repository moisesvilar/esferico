import { Box, Button, Container, Paper, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import Header from './components/Header';
import UserDataForm from './components/UserDataForm';
import DashboardScreen from './components/DashboardScreen';
import { auth, googleProvider, db } from './config/firebase';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';

function App() {
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          await fetchUserData(currentUser.uid);
        } catch (error) {
          console.error('Error al obtener datos del usuario:', error);
        }
      }
      setIsLoading(false);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  const fetchUserData = async (uid) => {
    if (!uid) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
      setError('Error al cargar los datos del usuario.');
    }
  };

  const handleLogin = async () => {
    try {
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      await fetchUserData(result.user.uid);
    } catch (error) {
      console.error('Error de autenticación:', error);
      setError('Error al intentar iniciar sesión. Por favor, inténtalo de nuevo.');
    }
  };

  const handleSubmitUserData = async (formData) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const processedData = {
        ...formData,
        edad: Number(formData.edad),
        peso: Number(formData.peso),
        altura: Number(formData.altura)
      };
      
      await setDoc(doc(db, 'users', user.uid), processedData);
      setUserData(processedData);
    } catch (error) {
      console.error('Error al guardar datos:', error);
      setError('Error al guardar los datos. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Typography>Cargando...</Typography>
      </Box>
    );
  }

  if (user) {
    return (
      <ThemeProvider theme={theme}>
        <Box sx={{ minHeight: '100vh', width: '100%', overflow: 'hidden' }}>
          <Header showMenu={true} />
          {userData ? (
            <DashboardScreen userName={user.displayName} />
          ) : (
            <Container maxWidth="md" sx={{ mt: 4 }}>
              <Paper elevation={3} sx={{ p: 3 }}>
                <UserDataForm onSubmit={handleSubmitUserData} isLoading={isLoading} />
              </Paper>
            </Container>
          )}
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', width: '100%', overflow: 'hidden' }}>
        <Header showMenu={false} />
        <Container 
          maxWidth="sm" 
          sx={{ 
            px: { xs: 2, sm: 3 },
            height: 'calc(100vh - 72px)',
          }}
        >
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Paper
              elevation={3}
              sx={{
                p: { xs: 2, sm: 4 },
                width: '100%',
                maxWidth: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Typography variant="h4" component="h1" align="center" gutterBottom>
                Bienvenido
              </Typography>
              
              <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 3 }}>
                Inicia sesión o crea una cuenta para continuar
              </Typography>

              {error && (
                <Typography color="error" align="center" sx={{ mb: 2 }}>
                  {error}
                </Typography>
              )}

              <Button
                fullWidth
                variant="contained"
                startIcon={<GoogleIcon />}
                onClick={handleLogin}
                sx={{ 
                  py: 1.5,
                  bgcolor: '#4285F4',
                  '&:hover': { 
                    bgcolor: '#357ABD'
                  }
                }}
              >
                Continuar con Google
              </Button>
            </Paper>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
