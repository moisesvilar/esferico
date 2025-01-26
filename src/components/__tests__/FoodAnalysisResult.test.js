import { render, fireEvent, waitFor, screen, act } from '@testing-library/react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, storage, db } from '../../config/firebase';
import FoodAnalysisResult from '../FoodAnalysisResult';

// Aumentar el timeout global para todos los tests
jest.setTimeout(10000);

// Mock de Firebase
jest.mock('../../config/firebase', () => {
  const mockAuth = {
    currentUser: { uid: 'test-user-id' },
    catch: jest.fn()
  };
  return {
    auth: mockAuth,
    storage: {},
    db: {},
    initializeApp: jest.fn()
  };
});

jest.mock('firebase/storage');
jest.mock('firebase/firestore');
jest.mock('firebase/auth', () => ({
  setPersistence: jest.fn(() => Promise.resolve()),
  browserLocalPersistence: 'browser',
  getAuth: jest.fn(() => ({ currentUser: { uid: 'test-user-id' } }))
}));

describe('FoodAnalysisResult - Image Handling', () => {
  const mockAnalysisData = {
    id: 'test-plate-id',
    description: 'Test Plate',
    components: [],
    createdAt: new Date('2024-01-01T12:00:00Z'),
    imageUrl: 'https://example.com/old_large.jpg',
    thumbnailUrl: 'https://example.com/old_thumb.jpg',
    imageId: 'old-image-id',
    imageHash: 'old-hash',
    hasImage: true,
    date: new Date('2024-01-01T12:00:00Z').toISOString()
  };

  const mockUserCreationDate = new Date('2024-01-01T00:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock implementations
    uploadBytes.mockResolvedValue({ ref: {} });
    getDownloadURL.mockImplementation((ref) => 
      Promise.resolve(`https://example.com/${ref._location.path}`)
    );
    ref.mockImplementation((storage, path) => ({ _location: { path } }));
    setDoc.mockImplementation((docRef, data) => Promise.resolve());
  });

  test('mantiene los datos de imagen existentes cuando no se sube una nueva imagen', async () => {
    const onSuccess = jest.fn();
    const { getByText } = render(
      <FoodAnalysisResult
        analysisData={mockAnalysisData}
        isEditing={true}
        currentDate={new Date('2024-01-15T12:00:00Z')}
        onSuccess={onSuccess}
        userCreationDate={mockUserCreationDate}
      />
    );

    fireEvent.click(getByText('Confirmar'));

    await waitFor(() => {
      expect(setDoc).toHaveBeenCalledWith(
        doc(db, 'plates', mockAnalysisData.id),
        expect.objectContaining({
          imageUrl: mockAnalysisData.imageUrl,
          thumbnailUrl: mockAnalysisData.thumbnailUrl,
          imageId: mockAnalysisData.imageId,
          imageHash: mockAnalysisData.imageHash,
          hasImage: true
        })
      );
    });
  });

  test('actualiza correctamente los datos de imagen al subir una nueva', async () => {
    const mockTimestamp = '123456789';
    jest.spyOn(Date, 'now').mockImplementation(() => Number(mockTimestamp));

    // Mock de File y FileReader
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(mockFile, 'size', { value: 1024 });

    // Mock de FileReader que ejecuta el callback inmediatamente
    global.FileReader = class MockFileReader {
      constructor() {
        this.onload = null;
        this.result = null;
      }
      readAsBinaryString(blob) {
        this.result = 'test-binary-string';
        Promise.resolve().then(() => {
          if (this.onload) {
            this.onload({ target: this });
          }
        });
      }
    };

    // Mock de Image para resizeImage
    global.Image = class MockImage {
      constructor() {
        setTimeout(() => {
          this.onload && this.onload();
        }, 0);
      }
      set src(value) {
        this.width = 800;
        this.height = 600;
      }
    };

    // Mock de canvas y context
    const mockContext = {
      drawImage: jest.fn()
    };
    const mockCanvas = {
      getContext: () => mockContext,
      width: 800,
      height: 600,
      toBlob: (callback) => callback(new Blob(['test'], { type: 'image/jpeg' }))
    };

    // Guardar la implementación original
    const originalCreateElement = document.createElement;

    // Mock createElement
    global.document.createElement = jest.fn((tag) => {
      if (tag === 'canvas') return mockCanvas;
      return originalCreateElement.call(document, tag);
    });

    // Mock de las funciones de Firebase
    const mockLargeRef = { _location: { path: `plates/test-user-id/${mockTimestamp}_large.jpg` } };
    const mockThumbRef = { _location: { path: `plates/test-user-id/${mockTimestamp}_thumb.jpg` } };
    
    ref.mockImplementation((storage, path) => {
      if (path.includes('_large.jpg')) return mockLargeRef;
      if (path.includes('_thumb.jpg')) return mockThumbRef;
      return { _location: { path } };
    });

    uploadBytes.mockImplementation((ref, blob) => Promise.resolve({ ref }));
    getDownloadURL.mockImplementation((ref) => Promise.resolve(`https://example.com/${ref._location.path}`));
    setDoc.mockResolvedValue();

    const onSuccess = jest.fn();
    const { getByText } = render(
      <FoodAnalysisResult
        analysisData={{
          ...mockAnalysisData,
          hasImage: false,
          imageUrl: null,
          thumbnailUrl: null,
          imageId: null,
          imageHash: null
        }}
        isEditing={true}
        currentDate={new Date('2024-01-15T12:00:00Z')}
        onSuccess={onSuccess}
        selectedImage={mockFile}
        userCreationDate={mockUserCreationDate}
      />
    );

    // Limpiar cualquier llamada previa
    jest.clearAllMocks();

    // Simular el click y esperar a que se procesen todas las promesas
    await act(async () => {
      fireEvent.click(getByText('Confirmar'));
      // Esperar a que se procesen todas las promesas
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verificar las llamadas
    expect(uploadBytes).toHaveBeenCalledTimes(2); // Una vez para large y otra para thumb
    expect(uploadBytes.mock.calls[0][0]._location.path).toContain('_large.jpg');
    expect(uploadBytes.mock.calls[1][0]._location.path).toContain('_thumb.jpg');

    expect(getDownloadURL).toHaveBeenCalledTimes(2);
    expect(setDoc).toHaveBeenCalledWith(
      doc(db, 'plates', mockAnalysisData.id),
      expect.objectContaining({
        hasImage: true,
        imageUrl: expect.stringContaining('_large.jpg'),
        thumbnailUrl: expect.stringContaining('_thumb.jpg'),
        imageId: mockTimestamp
      })
    );
    expect(onSuccess).toHaveBeenCalled();

    // Restaurar createElement
    global.document.createElement = originalCreateElement;
  });

  test('maneja correctamente los errores al subir imágenes', async () => {
    uploadBytes.mockRejectedValue(new Error('Upload failed'));

    const onSuccess = jest.fn();
    const { getByText } = render(
      <FoodAnalysisResult
        analysisData={mockAnalysisData}
        isEditing={true}
        currentDate={new Date('2024-01-15T12:00:00Z')}
        onSuccess={onSuccess}
        selectedImage={new File([''], 'test.jpg')}
        userCreationDate={mockUserCreationDate}
      />
    );

    await act(async () => {
      fireEvent.click(getByText('Confirmar'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Error al guardar los datos/i)).toBeInTheDocument();
      expect(onSuccess).not.toHaveBeenCalled();
    }, { timeout: 5000 });
  });
}); 