import { render, screen } from '@testing-library/react';
import App from './App';

test('renders loading text initially', () => {
  render(<App />);
  const loadingElement = screen.getByText(/Cargando.../i);
  expect(loadingElement).toBeInTheDocument();
});
