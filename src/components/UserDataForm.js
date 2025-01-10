import { useState, useEffect } from 'react';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, TextField, Typography, Divider } from '@mui/material';

function UserDataForm({ onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    sexo: '',
    edad: '',
    peso: '',
    altura: ''
  });
  const [bmr, setBmr] = useState(0);

  // Función para calcular BMR
  const calculateBMR = (weight, height, age, sex) => {
    if (!weight || !height || !age || !sex) return 0;
    
    // Fórmula base común
    const base = (10 * weight) + (6.25 * height) - (5 * age);
    
    // Ajuste según sexo
    return Math.round(sex === 'hombre' ? base + 5 : base - 161);
  };

  // Recalcular BMR cuando cambian los datos
  useEffect(() => {
    const newBmr = calculateBMR(
      Number(formData.peso),
      Number(formData.altura),
      Number(formData.edad),
      formData.sexo
    );
    setBmr(newBmr);
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formData, bmr });
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        Para calcular tu metabolismo basal, necesitamos algunos datos:
      </Typography>

      <FormControl fullWidth required>
        <InputLabel>Sexo</InputLabel>
        <Select
          name="sexo"
          value={formData.sexo}
          label="Sexo"
          onChange={handleChange}
        >
          <MenuItem value="hombre">Hombre</MenuItem>
          <MenuItem value="mujer">Mujer</MenuItem>
        </Select>
      </FormControl>

      <TextField
        required
        type="number"
        label="Edad"
        name="edad"
        value={formData.edad}
        onChange={handleChange}
        slotProps={{
          input: {
            min: 0, 
            max: 120,
            step: "1"
          }
        }}
        error={formData.edad !== '' && (formData.edad < 0 || formData.edad > 120)}
        helperText={formData.edad !== '' && (formData.edad < 0 || formData.edad > 120) ? "La edad debe estar entre 0 y 120" : ""}
      />

      <TextField
        required
        type="number"
        label="Peso (kg)"
        name="peso"
        value={formData.peso}
        onChange={handleChange}
        slotProps={{
          input: {
            min: 0, 
            max: 500,
            step: "0.1"
          }
        }}
        error={formData.peso !== '' && (formData.peso < 0 || formData.peso > 500)}
        helperText={formData.peso !== '' && (formData.peso < 0 || formData.peso > 500) ? "El peso debe estar entre 0 y 500 kg" : ""}
      />

      <TextField
        required
        type="number"
        label="Altura (cm)"
        name="altura"
        value={formData.altura}
        onChange={handleChange}
        slotProps={{
          input: {
            min: 0, 
            max: 300,
            step: "1"
          }
        }}
        error={formData.altura !== '' && (formData.altura < 0 || formData.altura > 300)}
        helperText={formData.altura !== '' && (formData.altura < 0 || formData.altura > 300) ? "La altura debe estar entre 0 y 300 cm" : ""}
      />

      <Divider sx={{ my: 2 }} />
      
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

      <Button
        type="submit"
        variant="contained"
        disabled={isLoading}
        sx={{ mt: 2 }}
      >
        {isLoading ? 'Guardando...' : 'Guardar datos'}
      </Button>
    </Box>
  );
}

export default UserDataForm; 