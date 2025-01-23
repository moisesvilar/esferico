import { useState, useEffect } from 'react';
import { 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText,
  Divider 
} from '@mui/material';
import { 
  Home,
  Person,
  Logout,
  CalendarMonth,
  Star
} from '@mui/icons-material';
import { auth, db } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import UpdateUserDataDialog from './UpdateUserDataDialog';
import FavoriteFoodsScreen from './FavoriteFoodsScreen';

function SideMenu({ isOpen, onClose, onMenuItemClick }) {
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);

  const menuItems = [
    { id: 'home', text: 'Inicio', icon: <Home /> },
    { id: 'week', text: 'Tu semana', icon: <CalendarMonth /> },
    { id: 'update-data', text: 'Actualizar datos', icon: <Person /> },
    // Aquí puedes añadir más opciones de menú
  ];

  // Cargar datos cuando se abre el diálogo
  useEffect(() => {
    const fetchUserData = async () => {
      if (isUpdateDialogOpen && auth.currentUser) {
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
  }, [isUpdateDialogOpen]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      onClose();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleUpdateDialogClose = (wasUpdated) => {
    setIsUpdateDialogOpen(false);
    if (wasUpdated) {
      // Aquí podrías refrescar los datos en el dashboard si es necesario
      onClose();
    }
  };

  return (
    <>
      <Drawer
        anchor="left"
        open={isOpen}
        onClose={onClose}
      >
        <List sx={{ width: 250 }}>
          {menuItems.map((item) => (
            <ListItem key={item.id} disablePadding>
              <ListItemButton 
                onClick={() => {
                  onMenuItemClick(item.id);
                  onClose();
                }}
              >
                <ListItemIcon>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}

<ListItem 
            button
            onClick={() => {
              setShowFavorites(true);
              onClose();
            }}
          >
            <ListItemIcon>
              <Star />
            </ListItemIcon>
            <ListItemText primary="Comidas favoritas" />
          </ListItem>
          
          <Divider sx={{ my: 1 }} />
          
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout}>
              <ListItemIcon>
                <Logout />
              </ListItemIcon>
              <ListItemText primary="Cerrar sesión" />
            </ListItemButton>
          </ListItem>

        </List>
      </Drawer>

      <UpdateUserDataDialog 
        open={isUpdateDialogOpen}
        onClose={handleUpdateDialogClose}
        currentData={userData}
      />

      {showFavorites && (
        <FavoriteFoodsScreen 
          onClose={() => setShowFavorites(false)} 
        />
      )}
    </>
  );
}

export default SideMenu; 