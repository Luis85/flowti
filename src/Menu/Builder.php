<?php

namespace App\Menu;


use App\Repository\DataRepository;
use Knp\Menu\FactoryInterface;
use Knp\Menu\ItemInterface;

class Builder
{
    private FactoryInterface $factory;
    private DataRepository $dataRepository;

    public function __construct(FactoryInterface $factory, DataRepository $dataRepository)
    {
        $this->factory = $factory;
        $this->dataRepository = $dataRepository;
    }

    public function createMainMenu(array $options): ItemInterface
    {
        $menu = $this->factory->createItem('root');
        $data = $this->dataRepository->findBy(['parent' => null]);
        $currentPage = $this->dataRepository->find($options['current_data_id']);

        foreach ($data as $item) {
            $menu->addChild($item->getId(), [
                'label' => $item->getTitle(),
                'route' => 'app_data_show',
                'routeParameters' => ['id' => $item->getId()]
            ]);
        }

        return $menu;
    }
}