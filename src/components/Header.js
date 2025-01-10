import { Box, Typography, IconButton } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { useState } from 'react';
import SideMenu from './SideMenu';

function Header({ showMenu = false }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      />
    </>
  );
}

export default Header; 