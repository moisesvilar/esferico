import { useState, useEffect } from 'react';
import { 
  Drawer, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  Divider 
} from '@mui/material';
import { 
  Logout, 
  Person 
} from '@mui/icons-material';
import { auth, db } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import UpdateUserDataDialog from './UpdateUserDataDialog';

function SideMenu({ isOpen, onClose }) {
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [userData, setUserData] = useState(null);

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

  const handleUpdateDataClick = () => {
    setIsUpdateDialogOpen(true);
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
      <Drawer anchor="left" open={isOpen} onClose={onClose}>
        <List sx={{ width: 250 }}>
          <ListItem onClick={handleUpdateDataClick} sx={{ cursor: 'pointer' }}>
            <ListItemIcon>
              <Person />
            </ListItemIcon>
            <ListItemText primary="Actualizar datos" />
          </ListItem>
          
          <Divider />
          
          <ListItem onClick={handleLogout} sx={{ cursor: 'pointer' }}>
            <ListItemIcon>
              <Logout />
            </ListItemIcon>
            <ListItemText primary="Cerrar sesión" />
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