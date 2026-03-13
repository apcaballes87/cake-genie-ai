import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopperCard } from './TopperCard';
import { MainTopperUI } from '@/types';

// Mock the icons and components that are not needed for this test
vi.mock('./icons', () => ({
  PencilIcon: () => <div data-testid="pencil-icon" />,
  PhotoIcon: () => <div data-testid="photo-icon" />,
  Loader2: () => <div data-testid="loader-2" />,
  ResetIcon: () => <div data-testid="reset-icon" />,
}));

vi.mock('./ColorPalette', () => ({
  ColorPalette: ({ selectedColor }: { selectedColor: string }) => (
    <div data-testid="color-palette">{selectedColor}</div>
  ),
}));

vi.mock('./MultiColorEditor', () => ({
  MultiColorEditor: () => <div data-testid="multi-color-editor" />,
}));

const createMockTopper = (type: string, description: string, overrides: Partial<MainTopperUI> = {}): MainTopperUI => ({
  id: 'test-id',
  type: type as any,
  original_type: type as any,
  description,
  isEnabled: true,
  price: 0,
  size: 'medium',
  quantity: 1,
  group_id: 'test-group',
  classification: 'hero',
  ...overrides,
});

describe('TopperCard - Color Customization', () => {
  const defaultProps = {
    type: 'topper' as const,
    expanded: true,
    onToggle: vi.fn(),
    updateItem: vi.fn(),
    onImageReplace: vi.fn(),
  };

  it('shows color palette for edible flowers', () => {
    const item = createMockTopper('edible_flowers', 'Flower');
    render(<TopperCard {...defaultProps} item={item} />);
    expect(screen.getByTestId('color-palette')).toBeInTheDocument();
  });

  it('shows color palette for macarons', () => {
    const item = createMockTopper('macarons', 'Pink Macarons');
    render(<TopperCard {...defaultProps} item={item} />);
    expect(screen.getByTestId('color-palette')).toBeInTheDocument();
  });

  it('shows color palette for isomalt', () => {
    const item = createMockTopper('isomalt', 'Glass Shards');
    render(<TopperCard {...defaultProps} item={item} />);
    expect(screen.getByTestId('color-palette')).toBeInTheDocument();
  });

  it('shows color palette for icing decorations', () => {
    const item = createMockTopper('icing_decorations', 'Icing Swirls');
    render(<TopperCard {...defaultProps} item={item} />);
    expect(screen.getByTestId('color-palette')).toBeInTheDocument();
  });

  it('shows color palette even when original_color is missing', () => {
    const item = createMockTopper('meringue', 'Meringue');
    // Ensure original_color is undefined
    delete (item as any).original_color;
    render(<TopperCard {...defaultProps} item={item} />);
    expect(screen.getByTestId('color-palette')).toBeInTheDocument();
  });

  it('shows color palette for icing_palette_knife', () => {
    const item = createMockTopper('icing_palette_knife', 'Knife Swipe');
    render(<TopperCard {...defaultProps} item={item} />);
    expect(screen.getByTestId('color-palette')).toBeInTheDocument();
  });

  it('shows color palette for marshmallows', () => {
    const item = createMockTopper('marshmallows', 'White Marshmallows');
    render(<TopperCard {...defaultProps} item={item} />);
    expect(screen.getByTestId('color-palette')).toBeInTheDocument();
  });

  it('shows color palette for edible_3d_ordinary', () => {
    const item = createMockTopper('edible_3d_ordinary', 'Gumpaste Ball');
    render(<TopperCard {...defaultProps} item={item} />);
    expect(screen.getByTestId('color-palette')).toBeInTheDocument();
  });
});
