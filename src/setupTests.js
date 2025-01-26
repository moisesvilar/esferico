// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import 'jest-canvas-mock';

// Mock fetch
global.fetch = jest.fn();

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock window.URL
window.URL.createObjectURL = jest.fn();
window.URL.revokeObjectURL = jest.fn();

// Mock Image
global.Image = class {
  constructor() {
    setTimeout(() => {
      this.onload && this.onload();
    });
  }
};
