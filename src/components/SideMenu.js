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
  Logout 
} from '@mui/icons-material';
import { auth, db } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import UpdateUserDataDialog from './UpdateUserDataDialog';

function SideMenu({ isOpen, onClose, onMenuItemClick }) {
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [userData, setUserData] = useState(null);

  const menuItems = [
    { id: 'home', text: 'Inicio', icon: <Home /> },
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
    </>
  );
}

export default SideMenu; 