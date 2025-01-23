import { Box, Typography, IconButton, Container } from '@mui/material';
import { Menu as MenuIcon, Close } from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SideMenu from './SideMenu';
import UserDataForm from './UserDataForm';
import { auth, db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import WeekScreen from './WeekScreen';

function Header({ showMenu = false }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showWeekScreen, setShowWeekScreen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      if (showUpdateForm && auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };

    fetchUserData();
  }, [showUpdateForm]);

  const handleMenuItemClick = (option) => {
    switch (option) {
      case 'home':
        navigate('/');
        break;
      case 'update-data':
        setShowUpdateForm(true);
        break;
      case 'week':
        setShowWeekScreen(true);
        break;
      default:
        break;
    }
  };

  const handleUpdateUserData = async (formData) => {
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), formData, { merge: true });
      setShowUpdateForm(false);
    } catch (error) {
      console.error('Error updating user data:', error);
    }
  };

  return (
    <>
      <Box 
        component="header" 
        sx={{
          padding: '1rem',
          backgroundColor: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1100
        }}
      >
        {showMenu && (
          <IconButton 
            edge="start" 
            color="inherit" 
            aria-label="menu" 
            onClick={() => setIsMenuOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}
        <Typography 
          variant="h4" 
          component="h1"
          sx={{
            fontFamily: '"Playwrite AU SA", serif',
            fontWeight: 100,
            color: '#000000',
            textAlign: 'center',
            fontSize: { xs: '1.75rem', sm: '2.125rem' },
            flexGrow: 1,
          }}
        >
          Esférico
        </Typography>
      </Box>

      <SideMenu 
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onMenuItemClick={handleMenuItemClick}
      />

      {showUpdateForm && (
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
              onClick={() => setShowUpdateForm(false)}
              sx={{ mr: 2 }}
            >
              <Close />
            </IconButton>
            <Typography variant="h6">
              Actualizar datos
            </Typography>
          </Box>
          
          <Container maxWidth="md" sx={{ py: 3 }}>
            <UserDataForm 
              onSubmit={handleUpdateUserData}
              initialData={userData}
              onCancel={() => setShowUpdateForm(false)}
            />
          </Container>
        </Box>
      )}

      {showWeekScreen && (
        <WeekScreen onClose={() => setShowWeekScreen(false)} />
      )}
    </>
  );
}

export default Header; 