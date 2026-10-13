import {
  IsIn,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const CATEGORIES = [
  'comics',
  'monnaies',
  'cartes-a-collectionner',
  'jouets-anciens',
  'timbres',
] as const;

export class CreateArticleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(50)
  description!: string;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsNumber()
  @IsPositive()
  shippingCost!: number;

  @IsString()
  @IsIn(CATEGORIES)
  category!: string;
}
