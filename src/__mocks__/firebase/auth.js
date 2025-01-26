class MockGoogleAuthProvider {
  setCustomParameters() { return this; }
}

const mockAuthState = {
  currentUser: { uid: 'test-user-id' }
};

const onAuthStateChanged = jest.fn((auth, callback) => {
  callback(mockAuthState.currentUser);
  return () => {};
});

module.exports = {
  setPersistence: jest.fn(() => Promise.resolve()),
  browserLocalPersistence: 'browser',
  getAuth: jest.fn(() => ({ 
    currentUser: mockAuthState.currentUser,
    catch: jest.fn()
  })),
  GoogleAuthProvider: MockGoogleAuthProvider,
  signOut: jest.fn(),
  signInWithPopup: jest.fn(),
  onAuthStateChanged
}; 