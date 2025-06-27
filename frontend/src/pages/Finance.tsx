import { Tab } from "@headlessui/react";
import ExpensesTab from "../components/finance/ExpensesTab";
import RevenueTab from "../components/finance/RevenueTab";

function classNames(...classes: string[]): string {
  return classes.filter(Boolean).join(' ');
}

export default function Finance() {
  return (
    <div className="py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Finance</h1>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <div className="py-4">
          <Tab.Group>
            <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 p-1">
              <Tab
                className={({ selected }) =>
                  classNames(
                    'w-full rounded-lg py-2.5 text-sm font-medium leading-5 bg-white',
                    'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'text-blue-700 shadow'
                      : 'text-gray-600 hover:text-blue-700'
                  )
                }
              >
                Revenue
              </Tab>
              <Tab
                className={({ selected }) =>
                  classNames(
                    'w-full rounded-lg py-2.5 text-sm font-medium leading-5 bg-white',
                    'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'text-blue-700 shadow'
                      : 'text-gray-600 hover:text-blue-700'
                  )
                }
              >
                Expenses
              </Tab>
            </Tab.List>
            <Tab.Panels>
              <Tab.Panel
                className={classNames(
                  'rounded-xl bg-white p-3',
                  'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2'
                )}
              >
                <RevenueTab />
              </Tab.Panel>
              <Tab.Panel
                className={classNames(
                  'rounded-xl bg-white p-3',
                  'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2'
                )}
              >
                <ExpensesTab />
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </div>
      </div>
    </div>
  );
} 