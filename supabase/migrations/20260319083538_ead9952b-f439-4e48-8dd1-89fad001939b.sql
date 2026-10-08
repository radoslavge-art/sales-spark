
-- Fix AE GES candidates (company_id: a039b366-be90-4f38-ba14-c2f6ff251809, first stage: 7e976e50-6024-46c9-83de-d6a250725a5d)
UPDATE candidates SET stage_id = '7e976e50-6024-46c9-83de-d6a250725a5d'
WHERE stage_id IS NULL AND position_id IN (SELECT id FROM positions WHERE company_id = 'a039b366-be90-4f38-ba14-c2f6ff251809');

-- Fix Керхер candidates (company_id: 965e4c15-198f-4a0f-81b5-06e862209f77, first stage: 274188a2-688b-4fe3-b4c9-d00708fef15a)
UPDATE candidates SET stage_id = '274188a2-688b-4fe3-b4c9-d00708fef15a'
WHERE stage_id IS NULL AND position_id IN (SELECT id FROM positions WHERE company_id = '965e4c15-198f-4a0f-81b5-06e862209f77');

-- Fix Темпекс candidates (company_id: 53d8fe0a-5b1e-4433-b4d5-9bff795e9fd2, first stage: d63ce639-6a11-4d5e-85a3-b13c5d44b3fd)
UPDATE candidates SET stage_id = 'd63ce639-6a11-4d5e-85a3-b13c5d44b3fd'
WHERE stage_id IS NULL AND position_id IN (SELECT id FROM positions WHERE company_id = '53d8fe0a-5b1e-4433-b4d5-9bff795e9fd2');
