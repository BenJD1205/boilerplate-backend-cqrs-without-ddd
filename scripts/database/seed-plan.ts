/**
 * Seed script: Import pricing plans vào DB
 *
 * Chạy:
 *   npm run seed:plans:local
 *   npm run seed:plans:dev
 *   npm run seed:plans:prod
 *
 * Script sẽ upsert (tạo mới nếu chưa có, cập nhật nếu đã tồn tại) tất cả các gói
 * tháng/năm vào bảng subscription_plans.
 */
import { AppDataSource } from './data-source.js';

interface PlanSeed {
  code: string;
  name: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  price: number;
  roomLimit: number;
  branchLimit: number;
  isActive: boolean;
}

const PLANS: PlanSeed[] = [
  {
    code: 'FREE_PLAN',
    name: 'Gói Miễn Phí',
    billingCycle: 'MONTHLY',
    price: 0,
    roomLimit: 20,
    branchLimit: 1,
    isActive: true,
  },
  {
    code: 'FREE_PLAN_YEARLY',
    name: 'Gói Miễn Phí - Năm',
    billingCycle: 'YEARLY',
    price: 0,
    roomLimit: 20,
    branchLimit: 1,
    isActive: true,
  },
  {
    code: 'BASIC_PLAN',
    name: 'Gói Cơ Bản',
    billingCycle: 'MONTHLY',
    price: 99000,
    roomLimit: 80,
    branchLimit: 4,
    isActive: true,
  },
  {
    code: 'BASIC_PLAN_YEARLY',
    name: 'Gói Cơ Bản - Năm',
    billingCycle: 'YEARLY',
    price: 1089000,
    roomLimit: 80,
    branchLimit: 4,
    isActive: true,
  },
  {
    code: 'ADVANCED_PLAN',
    name: 'Gói Nâng Cao',
    billingCycle: 'MONTHLY',
    price: 299000,
    roomLimit: 200,
    branchLimit: 10,
    isActive: true,
  },
  {
    code: 'ADVANCED_PLAN_YEARLY',
    name: 'Gói Nâng Cao - Năm',
    billingCycle: 'YEARLY',
    price: 3289000,
    roomLimit: 200,
    branchLimit: 10,
    isActive: true,
  },
  {
    code: 'PREMIUM_PLAN',
    name: 'Gói Cao Cấp',
    billingCycle: 'MONTHLY',
    price: 499000,
    roomLimit: 500,
    branchLimit: 25,
    isActive: true,
  },
  {
    code: 'PREMIUM_PLAN_YEARLY',
    name: 'Gói Cao Cấp - Năm',
    billingCycle: 'YEARLY',
    price: 5489000,
    roomLimit: 500,
    branchLimit: 25,
    isActive: true,
  },
  {
    code: 'ENTERPRISE_PLAN',
    name: 'Gói Hợp Tác',
    billingCycle: 'MONTHLY',
    price: 0,
    roomLimit: 1000,
    branchLimit: 50,
    isActive: true,
  },
  {
    code: 'ENTERPRISE_PLAN_YEARLY',
    name: 'Gói Hợp Tác - Năm',
    billingCycle: 'YEARLY',
    price: 0,
    roomLimit: 1000,
    branchLimit: 50,
    isActive: true,
  },
];

async function seed() {
  await AppDataSource.initialize();
  console.log('Database connected');

  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.startTransaction();

    for (const plan of PLANS) {
      // Kiểm tra gói đã tồn tại chưa (theo code - unique constraint)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const existing = await queryRunner.query(
        `SELECT id FROM subscription_plans WHERE code = $1`,
        [plan.code],
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (existing?.length > 0) {
        // Cập nhật nếu đã tồn tại
        await queryRunner.query(
          `UPDATE subscription_plans
           SET name = $1, price = $2, room_limit = $3, branch_limit = $4, is_active = $5, billing_cycle = $6, updated_at = NOW()
           WHERE code = $7`,
          [
            plan.name,
            plan.price,
            plan.roomLimit,
            plan.branchLimit,
            plan.isActive,
            plan.billingCycle,
            plan.code,
          ],
        );
      } else {
        // Tạo mới nếu chưa tồn tại
        await queryRunner.query(
          `INSERT INTO subscription_plans (code, name, billing_cycle, price, room_limit, branch_limit, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            plan.code,
            plan.name,
            plan.billingCycle,
            plan.price,
            plan.roomLimit,
            plan.branchLimit,
            plan.isActive,
          ],
        );
        console.log(`Created: ${plan.code}`);
      }
    }

    await queryRunner.commitTransaction();
    console.log(`\nSeed completed! ${PLANS.length} plans processed.`);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

void seed();
