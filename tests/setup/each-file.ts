import { afterAll } from 'vitest';
import { prisma } from '../helpers';

// Отключаемся от тестовой базы до того, как её остановят
afterAll(() => prisma.$disconnect());
