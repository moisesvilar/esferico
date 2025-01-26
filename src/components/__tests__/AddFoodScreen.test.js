import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddFoodScreen from '../AddFoodScreen';
import { storage, auth, db } from '../../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, getDocs } from 'firebase/firestore';
import userEvent from '@testing-library/user-event';

// Aumentar timeout para todos los tests en este archivo
jest.setTimeout(30000);

// Mock Firebase
jest.mock('../../config/firebase', () => ({
  storage: {
    ref: jest.fn()
  },
  auth: {
    currentUser: {
      uid: 'test-user-id'
    }
  },
  db: {
    collection: jest.fn(),
    query: jest.fn()
  }
}));

// Mock Firebase Storage functions
jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn()
}));

// Mock Firebase Firestore functions
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

// Mock para MUI Transitions
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  Fade: ({ children }) => children,
  Dialog: ({ children, open }) => open ? children : null
}));

describe('AddFoodScreen', () => {
  const mockOnClose = jest.fn();
  const mockOnImageAnalyzed = jest.fn();
  const currentDate = new Date();
  let rendered;
  let user;

  beforeEach(async () => {
    jest.clearAllMocks();
    user = userEvent.setup();
    
    // Mock successful storage upload
    ref.mockReturnValue('mock-storage-ref');
    uploadBytes.mockResolvedValue({ ref: 'mock-upload-ref' });
    getDownloadURL.mockResolvedValue('https://example.com/image.jpg');
    
    // Mock successful API response
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        description: 'Test Meal',
        components: []
      }))
    });

    // Mock empty duplicates query
    getDocs.mockResolvedValue({ 
      empty: true, 
      docs: [],
      forEach: jest.fn()
    });

    // Render component
    await act(async () => {
      rendered = render(
        <AddFoodScreen 
          open={true}
          onClose={mockOnClose}
          onImageAnalyzed={mockOnImageAnalyzed}
          currentDate={currentDate}
        />
      );
    });
  });

  it('renders correctly', () => {
    // En el estado inicial solo se muestra el botón de entrada manual
    expect(screen.getByTestId('manual-input-button')).toBeInTheDocument();
  });

  it('shows photo options when clicking photo button', async () => {
    // Primero hacemos click en el botón de foto
    await act(async () => {
      await user.click(screen.getByText(/foto/i));
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Ahora deberían estar visibles los botones de foto y galería
    expect(screen.getByTestId('take-photo-button')).toBeInTheDocument();
    expect(screen.getByTestId('gallery-button')).toBeInTheDocument();
  });

  it('handles image upload and analysis correctly', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    // Primero hacemos click en el botón de foto para mostrar las opciones
    await act(async () => {
      await user.click(screen.getByTestId('photo-button'));
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Simular click en el botón de galería
    await act(async () => {
      await user.click(screen.getByTestId('gallery-button'));
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Obtener el input de archivo usando el test-id
    const fileInput = screen.getByTestId('file-input');
    expect(fileInput).toBeInTheDocument();

    // Simular la selección del archivo
    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        configurable: true
      });
      fireEvent.change(fileInput);
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    // Verificar que se llama a la función de subida
    expect(uploadBytes).toHaveBeenCalled();
    expect(getDownloadURL).toHaveBeenCalled();

    // Verificar el resultado final
    await waitFor(() => {
      expect(mockOnImageAnalyzed).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({
          imageUrl: expect.any(String),
          hasImage: true
        })
      );
    }, { timeout: 10000 });
  });

  it('handles duplicate images correctly', async () => {
    const existingPlate = {
      description: 'Existing Meal',
      components: [],
      imageUrl: 'https://example.com/existing.jpg'
    };

    getDocs.mockResolvedValue({
      empty: false,
      docs: [{
        data: () => existingPlate
      }],
      forEach: jest.fn(cb => cb({ data: () => existingPlate }))
    });

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    await act(async () => {
      const fileInput = screen.getByTestId('file-input');
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        configurable: true
      });
      fireEvent.change(fileInput);
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    await waitFor(() => {
      expect(mockOnImageAnalyzed).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({
          description: expect.stringContaining('Copia de Existing Meal')
        })
      );
    }, { timeout: 10000 });
  });

  it('handles errors correctly', async () => {
    uploadBytes.mockRejectedValue(new Error('Upload failed'));

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    await act(async () => {
      const fileInput = screen.getByTestId('file-input');
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        configurable: true
      });
      fireEvent.change(fileInput);
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    await waitFor(() => {
      const errorElement = screen.getByText(/Error al procesar la imagen/i);
      expect(errorElement).toBeInTheDocument();
    }, { timeout: 10000 });
  });
}); 