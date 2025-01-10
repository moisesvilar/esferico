import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: [
      'Roboto',
      'sans-serif',
    ].join(','),
    h1: {
      fontFamily: '"Playwrite AU SA", serif',
    }
  },
});

export default theme; 