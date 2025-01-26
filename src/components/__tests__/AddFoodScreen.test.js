import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddFoodScreen from '../AddFoodScreen';
import { storage, auth, db } from '../../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, getDocs } from 'firebase/firestore';

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

describe('AddFoodScreen', () => {
  const mockOnClose = jest.fn();
  const mockOnImageAnalyzed = jest.fn();
  const currentDate = new Date();

  beforeEach(() => {
    jest.clearAllMocks();
    
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
  });

  it('renders correctly', () => {
    render(
      <AddFoodScreen 
        open={true}
        onClose={mockOnClose}
        onImageAnalyzed={mockOnImageAnalyzed}
        currentDate={currentDate}
      />
    );

    expect(screen.getByText('Analizar una foto')).toBeInTheDocument();
    expect(screen.getByText('Introducción manual')).toBeInTheDocument();
  });

  it('handles image upload and analysis correctly', async () => {
    render(
      <AddFoodScreen 
        open={true}
        onClose={mockOnClose}
        onImageAnalyzed={mockOnImageAnalyzed}
        currentDate={currentDate}
      />
    );

    // Simular selección de imagen
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    // Simular click en "Analizar una foto"
    await act(async () => {
      fireEvent.click(screen.getByText('Analizar una foto'));
    });
    
    // Simular click en "Elegir de la galería"
    await act(async () => {
      fireEvent.click(screen.getByText('Elegir de la galería'));
    });

    // Simular la selección del archivo
    await act(async () => {
      const handleImageSelected = await import('../AddFoodScreen').then(
        module => module.default.prototype.handleImageSelected
      );
      await handleImageSelected.call({ props: { onImageAnalyzed: mockOnImageAnalyzed } }, file);
    });

    // Verificar que la imagen se procesa correctamente
    await waitFor(() => {
      expect(uploadBytes).toHaveBeenCalled();
      expect(getDownloadURL).toHaveBeenCalled();
      expect(mockOnImageAnalyzed).toHaveBeenCalledWith(
        file,
        expect.objectContaining({
          imageUrl: 'https://example.com/image.jpg',
          hasImage: true
        })
      );
    });
  });

  it('handles duplicate images correctly', async () => {
    // Mock existing plate
    const existingPlate = {
      description: 'Existing Meal',
      components: [],
      imageUrl: 'https://example.com/existing.jpg'
    };

    // Mock duplicates found
    getDocs.mockResolvedValue({
      empty: false,
      docs: [{
        data: () => existingPlate
      }],
      forEach: jest.fn()
    });

    render(
      <AddFoodScreen 
        open={true}
        onClose={mockOnClose}
        onImageAnalyzed={mockOnImageAnalyzed}
        currentDate={currentDate}
      />
    );

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    // Simular la selección del archivo directamente
    await act(async () => {
      const handleImageSelected = await import('../AddFoodScreen').then(
        module => module.default.prototype.handleImageSelected
      );
      await handleImageSelected.call({ props: { onImageAnalyzed: mockOnImageAnalyzed } }, file);
    });

    // Verificar que se usa el plato existente
    await waitFor(() => {
      expect(mockOnImageAnalyzed).toHaveBeenCalledWith(
        file,
        expect.objectContaining({
          description: expect.stringContaining('Copia de Existing Meal')
        })
      );
    });
  });

  it('handles errors correctly', async () => {
    // Mock error in upload
    uploadBytes.mockRejectedValue(new Error('Upload failed'));

    render(
      <AddFoodScreen 
        open={true}
        onClose={mockOnClose}
        onImageAnalyzed={mockOnImageAnalyzed}
        currentDate={currentDate}
      />
    );

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    // Simular la selección del archivo directamente
    await act(async () => {
      const handleImageSelected = await import('../AddFoodScreen').then(
        module => module.default.prototype.handleImageSelected
      );
      await handleImageSelected.call({ 
        props: { onImageAnalyzed: mockOnImageAnalyzed },
        setError: (error) => {
          expect(error).toContain('Error al procesar la imagen');
        },
        setIsUploading: jest.fn()
      }, file);
    });
  });
}); 