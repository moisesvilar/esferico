import { useState, useEffect } from 'react';
import { 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Stack,
  Typography,
  Box,
  Divider
} from '@mui/material';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

function UpdateUserDataDialog({ open, onClose, currentData }) {
  const [formData, setFormData] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [bmr, setBmr] = useState(0);

  // Función para calcular BMR
  const calculateBMR = (weight, height, age, sex) => {
    if (!weight || !height || !age || !sex) return 0;

    // Fórmula base común
    const base = (10 * weight) + (6.25 * height) - (5 * age);

    // Ajuste según sexo
    return Math.round(sex === 'hombre' ? base + 5 : base - 161);
  };

  useEffect(() => {
    if (currentData) {
      setFormData({
        sexo: currentData.sexo || '',
        edad: currentData.edad || '',
        peso: currentData.peso || '',
        altura: currentData.altura || ''
      });
    }
  }, [currentData]);

  useEffect(() => {
    const newBmr = calculateBMR(
      Number(formData.peso),
      Number(formData.altura),
      Number(formData.edad),
      formData.sexo
    );
    setBmr(newBmr);
  }, [formData.peso, formData.altura, formData.edad, formData.sexo]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    setIsUpdating(true);
    try {
      const processedData = {
        ...formData,
        edad: Number(formData.edad),
        peso: Number(formData.peso),
        altura: Number(formData.altura),
        bmr: bmr // Guardamos el BMR calculado
      };
      
      await updateDoc(doc(db, 'users', auth.currentUser.uid), processedData);
      onClose(true);
    } catch (error) {
      console.error('Error updating user data:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} fullWidth maxWidth="sm">
      <DialogTitle>Actualizar datos personales</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Sexo</InputLabel>
            <Select
              name="sexo"
              value={formData.sexo || ''}
              label="Sexo"
              onChange={handleChange}
            >
              <MenuItem value="hombre">Hombre</MenuItem>
              <MenuItem value="mujer">Mujer</MenuItem>
            </Select>
          </FormControl>

          <TextField
            type="number"
            label="Edad"
            name="edad"
            value={formData.edad || ''}
            onChange={handleChange}
            fullWidth
          />

          <TextField
            type="number"
            label="Peso (kg)"
            name="peso"
            value={formData.peso || ''}
            onChange={handleChange}
            fullWidth
          />

          <TextField
            type="number"
            label="Altura (cm)"
            name="altura"
            value={formData.altura || ''}
            onChange={handleChange}
            fullWidth
          />

          <Divider />
          
          <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Metabolismo Basal (BMR)
            </Typography>
            <Typography variant="h6">
              {bmr} kcal/día
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Calorías que tu cuerpo consume en reposo
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>Cancelar</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={isUpdating}
        >
          {isUpdating ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default UpdateUserDataDialog; 